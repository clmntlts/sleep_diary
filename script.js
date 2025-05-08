// --- Supabase Initialization ---
// IMPORTANT: Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = "https://wvdggsrxtjdlfezenbbz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZGdnc3J4dGpkbGZlemVuYmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwNDc5NDcsImV4cCI6MjA1NTYyMzk0N30.4hJtANpuD5xx_J0Ukk6QoqTcnbV0gkjMeD2HcP5QxB8"; // Adjusted key slightly for example, use original
// NOTE: The key you provided looks like a placeholder/example key, not a real anon key.
// Make sure you replace this with your project's actual Anon Key from Supabase Project Settings -> API.

let supabase;
try {
    if (!window.supabase) {
        throw new Error("Supabase client not found. Make sure the Supabase CDN script is loaded before scripts.js.");
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (SUPABASE_URL === "YOUR_SUPABASE_URL") {
        console.warn("Supabase URL is a placeholder. Replace with your actual Supabase URL.");
    }
} catch (error) {
    console.error("Error initializing Supabase client:", error);
    displayAuthMessage("Critical error: Could not initialize database connection. App functionality will be limited.", "error");
}

// --- DOM Elements ---
const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const signupButton = document.getElementById("signupButton");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const userInfoDiv = document.getElementById("userInfo");
const authMessageDiv = document.getElementById("authMessage");
const authFormsDiv = document.getElementById("authForms");
const addDayButton = document.getElementById("addDayButton");
const diaryDiv = document.getElementById("diary");

// --- Global State ---
let localDayCounter = 0; // Used for generating new day numbers if no data loaded
let currentUserId = null;
let activeDrags = 0; // Counter for active drag operations to prevent premature saves
let saveTimeoutId = null; // To debounce saves during dragging

// --- Time Conversion Constants and Utilities ---
// Timeline represents 24 hours starting from 12:00 PM (noon)
const TIMELINE_START_HOUR_OFFSET = 12; // 12 PM is our 0%

/**
 * Converts a timeline percentage (0-1) to an "HH:MM:SS" time string.
 * The timeline starts at 12:00 (noon).
 * @param {number} percent - The percentage position on the timeline (0 to 1).
 * @returns {string} Time in "HH:MM:SS" format.
 */
function percentToTimeStr(percent) {
    if (percent < 0) percent = 0;
    if (percent > 1) percent = 1;

    const totalMinutes = percent * 24 * 60;
    let hour = Math.floor(totalMinutes / 60) + TIMELINE_START_HOUR_OFFSET;
    const minute = Math.floor(totalMinutes % 60);
    // const second = Math.floor((totalMinutes * 60) % 60); // Usually not needed for this granularity

    hour = hour % 24; // Ensure hour is within 0-23 range

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

/**
 * Converts an "HH:MM:SS" time string to a timeline percentage (0-1).
 * @param {string} timeStr - Time in "HH:MM[:SS]" format.
 * @returns {number} Percentage position on the timeline (0 to 1).
 */
function timeStrToPercent(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    // const second = parts[2] ? parseInt(parts[2], 10) : 0;

    let totalMinutes = (hour * 60) + minute; // + second / 60;

    // Adjust for timeline starting at TIMELINE_START_HOUR_OFFSET (12 PM)
    totalMinutes = (totalMinutes - (TIMELINE_START_HOUR_OFFSET * 60) + (24 * 60)) % (24*60);

    return totalMinutes / (24 * 60);
}

/**
 * Calculates duration in hours from start and end percentages on the timeline.
 * Handles wrap-around (e.g., end percent is less than start percent).
 * @param {number} startPercent - Start position as a percentage (0-1).
 * @param {number} endPercent - End position as a percentage (0-1).
 * @returns {number} Duration in hours.
 */
function calculateHoursFromPercents(startPercent, endPercent) {
    let durationPercent;
    // Normalize percentages to be within [0, 1) range
    startPercent = (startPercent % 1 + 1) % 1;
    endPercent = (endPercent % 1 + 1) % 1;

    if (endPercent >= startPercent) {
        durationPercent = endPercent - startPercent;
    } else {
        durationPercent = (1 - startPercent) + endPercent; // Wraps around the 100% mark
    }
    return durationPercent * 24;
}


// --- Authentication Functions ---
function displayAuthMessage(message, type) {
    if (!authMessageDiv) return;
    authMessageDiv.textContent = message;
    const baseClasses = "mt-4 text-sm p-3 rounded-md";
    if (type === 'success') {
        authMessageDiv.className = `${baseClasses} bg-green-100 text-green-700 border border-green-300`;
    } else if (type === 'error') {
        authMessageDiv.className = `${baseClasses} bg-red-100 text-red-700 border border-red-300`;
    } else {
        authMessageDiv.className = `${baseClasses} bg-gray-100 text-gray-700 border border-gray-300`;
    }
}

async function handleSignUp() {
    if (!supabase || !signupEmailInput || !signupPasswordInput) return;
    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;

    if (!email || !password) {
        displayAuthMessage("Email and password are required for signup.", "error");
        return;
    }
    if (password.length < 6) {
        displayAuthMessage("Password must be at least 6 characters long.", "error");
        return;
    }

    displayAuthMessage("Signing up...", "info");
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        displayAuthMessage("Error signing up: " + error.message, "error");
    } else {
        // data.user contains the user object. data.session might be null if email confirmation is required.
        displayAuthMessage("Signup successful! Check your email for verification. You can then log in.", "success");
        // The onAuthStateChange listener will handle UI updates if auto-signed-in.
    }
}

async function handleLogin() {
    if (!supabase || !loginEmailInput || !loginPasswordInput) return;
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (!email || !password) {
        displayAuthMessage("Email and password are required for login.", "error");
        return;
    }
    displayAuthMessage("Logging in...", "info");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        displayAuthMessage("Login failed: " + error.message, "error");
    } else {
        displayAuthMessage("Login successful!", "success");
        // The onAuthStateChange listener will handle UI updates and data loading.
    }
}

async function handleLogout() {
    if (!supabase) return;
    displayAuthMessage("Logging out...", "info");
    const { error } = await supabase.auth.signOut();
    if (error) {
        displayAuthMessage("Logout failed: " + error.message, "error");
    } else {
        displayAuthMessage("You have been logged out.", "success");
        // onAuthStateChange will clear UI.
    }
}

function updateUserUI(user) {
    if (user) {
        currentUserId = user.id;
        if (userInfoDiv) userInfoDiv.innerHTML = `Logged in as: <span class="font-semibold">${user.email}</span>`;
        if (authFormsDiv) authFormsDiv.classList.add("hidden");
        if (logoutButton) logoutButton.classList.remove("hidden");
        if (addDayButton) addDayButton.disabled = false;
        loadUserData(); // Load user's data after successful login
    } else {
        currentUserId = null;
        if (userInfoDiv) userInfoDiv.textContent = "You are not logged in.";
        if (authFormsDiv) authFormsDiv.classList.remove("hidden");
        if (logoutButton) logoutButton.classList.add("hidden");
        if (addDayButton) addDayButton.disabled = true;
        if (diaryDiv) diaryDiv.innerHTML = ''; // Clear existing diary entries
        resetGlobalStatistics();
        localDayCounter = 0; // Reset day counter on logout
    }
}

// --- NEW: Load User Data Function ---
async function loadUserData() {
    if (!currentUserId || !supabase) {
        console.warn("Cannot load user data: user not logged in or supabase client not initialized.");
        return;
    }

    console.log("Attempting to load user data for:", currentUserId);
    displayAuthMessage("Loading sleep diary...", "info");
    // IMPORTANT: This query assumes you have a foreign key constraint
    // from 'sleep_periods' to 'sleep_record' in your database schema.
    // E.g., 'sleep_periods' has a column 'sleep_record_id' referencing 'sleep_record.id'.
    // If your schema is different, the select syntax or loading logic needs adjustment.
    const { data: records, error } = await supabase
        .from('sleep_record')
        .select('*, sleep_periods(*)') // This line requires the FK relationship for PGRST200 error fix
        .eq('user_id', currentUserId)
        .order('day_count', { ascending: false }); // Order by day_count

    if (error) {
        console.error("Error loading user data:", error);
        displayAuthMessage("Error loading sleep diary: " + error.message, "error");
    } else {
        console.log("User data loaded:", records);
        if (diaryDiv) diaryDiv.innerHTML = ''; // Clear current view before loading
        localDayCounter = 0; // Reset counter before populating
        if (records && records.length > 0) {
            // Find the highest day_count from loaded records to continue numbering
            localDayCounter = Math.max(...records.map(r => r.day_count));
            records.forEach(record => addDay(record));
            displayAuthMessage(`Loaded ${records.length} day(s).`, "success");
        } else {
            displayAuthMessage("No sleep diary data found. Add a day to get started!", "info");
        }
         updateGlobalStatistics(); // Calculate and display global stats after loading
    }
}


// --- Diary Core Logic ---

/**
 * Adds a new day entry to the UI.
 * If recordData is provided, it populates the day with that data (used when loading from DB).
 * @param {object|null} recordData - Optional data to populate the new day (from sleep_record table, possibly including nested sleep_periods).
 */
function addDay(recordData = null) {
    const dayNumber = recordData ? recordData.day_count : ++localDayCounter;
    // Ensure localDayCounter is at least the loaded day_count if loading
    if (recordData && recordData.day_count > localDayCounter) {
        localDayCounter = recordData.day_count;
    }

    const dayDiv = document.createElement("div");
    dayDiv.className = "day p-6 bg-white rounded-lg shadow-md border border-gray-200";
    dayDiv.id = `dayEntry${dayNumber}`;
    dayDiv.dataset.dayId = dayNumber; // Store dayNumber for easier access
    if (recordData && recordData.id) {
        dayDiv.dataset.dbId = recordData.id; // Store database ID of the sleep_record
    }

    // Default values or values from recordData
    // Note: Storing time as HH:MM:SS string in DB, convert to percent for UI
    const initialBedtimePercent = recordData ? timeStrToPercent(recordData.bedtime) : 0.25; // Default 6 PM (0.25 on 12PM-12PM scale)
    const initialWakeTimePercent = recordData ? timeStrToPercent(recordData.wake_time) : 0.75; // Default 6 AM (0.75 on 12PM-12PM scale)
    const initialSleepQuality = recordData?.sleep_quality ?? 5;
    const initialMorningFatigue = recordData?.morning_fatigue ?? 5;

    dayDiv.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-xl font-semibold text-indigo-600">Day ${dayNumber}</h3>
            <button class="deleteDayButton bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs">Delete Day</button>
        </div>
        <div class="timeline-container mb-4">
            <div class="timeline-labels">
                <span>12PM</span><span>3PM</span><span>6PM</span><span>9PM</span><span>12AM</span><span>3AM</span><span>6AM</span><span>9AM</span><span>12PM</span>
            </div>
            <div class="timeline" id="timeline${dayNumber}">
                <div class="marker bg-blue-600" id="bedtime${dayNumber}" style="left: ${initialBedtimePercent * 100}%;"></div>
                <div class="marker bg-green-500" id="wakeTime${dayNumber}" style="left: ${initialWakeTimePercent * 100}%;"></div>
                </div>
            <div class="timeline-ticks">
                ${Array.from({ length: 9 }, (_, i) => `<span></span>`).join('')}
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
                <label for="sleepQuality${dayNumber}" class="block text-sm font-medium text-gray-700">Sleep Quality: <span id="sleepQualityLabel${dayNumber}" class="text-indigo-700 font-semibold">${initialSleepQuality}</span>/10</label>
                <input type="range" min="0" max="10" step="1" value="${initialSleepQuality}" id="sleepQuality${dayNumber}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-1">
            </div>
            <div>
                <label for="morningFatigue${dayNumber}" class="block text-sm font-medium text-gray-700">Morning Fatigue: <span id="morningFatigueLabel${dayNumber}" class="text-indigo-700 font-semibold">${initialMorningFatigue}</span>/10</label>
                <input type="range" min="0" max="10" step="1" value="${initialMorningFatigue}" id="morningFatigue${dayNumber}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-1">
            </div>
        </div>
        <div class="space-y-1 text-sm mb-4 p-3 bg-gray-50 rounded-md">
            <p>Time in Bed: <span id="timeInBed${dayNumber}" class="font-semibold">0</span> hours</p>
            <p>Total Sleep Time: <span id="totalSleep${dayNumber}" class="font-semibold">0</span> hours</p>
            <p>Sleep Efficiency: <span id="daySleepEfficiency${dayNumber}" class="font-semibold">0</span>%</p>
        </div>
        <button class="addSleepPeriodButton bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-4 rounded-md text-sm">Add Sleep Period</button>
    `;
    diaryDiv.prepend(dayDiv); // Show newest days first

    // Attach event listeners
    const bedtimeMarker = document.getElementById(`bedtime${dayNumber}`);
    const wakeTimeMarker = document.getElementById(`wakeTime${dayNumber}`);
    const sleepQualitySlider = document.getElementById(`sleepQuality${dayNumber}`);
    const morningFatigueSlider = document.getElementById(`morningFatigue${dayNumber}`);
    const addSleepPeriodBtn = dayDiv.querySelector('.addSleepPeriodButton');
    const deleteDayBtn = dayDiv.querySelector('.deleteDayButton');

    bedtimeMarker?.addEventListener('mousedown', (e) => startMarkerDrag(e, `bedtime${dayNumber}`, dayNumber));
    wakeTimeMarker?.addEventListener('mousedown', (e) => startMarkerDrag(e, `wakeTime${dayNumber}`, dayNumber));
    sleepQualitySlider?.addEventListener('input', () => updateSleepQuality(dayNumber));
    morningFatigueSlider?.addEventListener('input', () => updateMorningFatigue(dayNumber));
    addSleepPeriodBtn?.addEventListener('click', () => createNewSleepPeriodUI(dayNumber));
    deleteDayBtn?.addEventListener('click', () => handleDeleteDayEntry(dayNumber));

    // If loading data, create sleep period elements
    const timelineDiv = document.getElementById(`timeline${dayNumber}`);
    // recordData.sleep_periods will be an array if loaded with nested select
    if (recordData && recordData.sleep_periods && timelineDiv) {
        // Sort periods by start time or period_id if needed for display
        recordData.sleep_periods.sort((a, b) => timeStrToPercent(a.start_time) - timeStrToPercent(b.start_time));

        recordData.sleep_periods.forEach(periodData => {
             // Calculate start and end percentages from DB time strings
            const startPercent = timeStrToPercent(periodData.start_time);
            const endPercent = timeStrToPercent(periodData.end_time);

            // Calculate width percentage based on duration or end-start
            // Using end-start (handling wrap) for UI width calculation is simpler here
            let widthPercent;
             if (endPercent >= startPercent) {
                 widthPercent = endPercent - startPercent;
             } else { // Wraps around
                 widthPercent = (1 - startPercent) + endPercent;
             }

            const sleepPeriodEl = createSleepPeriodElement(dayNumber, startPercent * 100, widthPercent * 100, periodData.period_id, periodData.id);
            timelineDiv.appendChild(sleepPeriodEl);
        });
    }
    updateStatistics(dayNumber, false); // Initial calculation, don't save yet if loading
}

function startMarkerDrag(event, elementId, dayId) {
    event.preventDefault();
    activeDrags++;
    const element = document.getElementById(elementId);
    const parent = element.parentElement; // The timeline div
    if (!element || !parent) { activeDrags--; return; }

    const parentRect = parent.getBoundingClientRect();
    let shiftX = event.clientX - element.getBoundingClientRect().left;

    function onMouseMove(moveEvent) {
        let newLeftPx = moveEvent.clientX - shiftX - parentRect.left;
        // Clamp position within timeline bounds
        if (newLeftPx < 0) newLeftPx = 0;
        const maxLeftPx = parent.offsetWidth - element.offsetWidth; // Markers have tiny width, element.offsetWidth is fine
        if (newLeftPx > maxLeftPx) newLeftPx = maxLeftPx;

        element.style.left = newLeftPx + 'px';
        updateStatistics(dayId, false); // Update UI but don't save on every mouse move
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        activeDrags--;
        // Use a small timeout before saving to allow multiple drags on different elements to finish
        clearTimeout(saveTimeoutId);
        saveTimeoutId = setTimeout(() => {
            if (activeDrags === 0) {
                 console.log("All drags finished, triggering save for day:", dayId);
                updateStatistics(dayId, true); // Final update and save
            }
        }, 100); // Save after 100ms of no drag activity
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function updateSleepQuality(dayId) {
    const qualitySlider = document.getElementById(`sleepQuality${dayId}`);
    const qualityLabel = document.getElementById(`sleepQualityLabel${dayId}`);
    if (qualitySlider && qualityLabel) qualityLabel.textContent = qualitySlider.value;
     // Debounce save for slider updates too
    clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(() => {
         console.log("Sleep quality updated, triggering save for day:", dayId);
        updateStatistics(dayId, true);
    }, 100);
}

function updateMorningFatigue(dayId) {
    const fatigueSlider = document.getElementById(`morningFatigue${dayId}`);
    const fatigueLabel = document.getElementById(`morningFatigueLabel${dayId}`);
    if (fatigueSlider && fatigueLabel) fatigueLabel.textContent = fatigueSlider.value;
     // Debounce save for slider updates too
    clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(() => {
         console.log("Morning fatigue updated, triggering save for day:", dayId);
        updateStatistics(dayId, true);
    }, 100);
}


/**
 * Creates a DOM element for a sleep period with interactivity.
 * @param {number} dayId - The day ID.
 * @param {number} initialLeftPercent - Initial left position (0-100).
 * @param {number} initialWidthPercent - Initial width (0-100).
 * @param {number} periodId - The client-side period_id (1, 2, ... for this day).
 * @param {number|null} dbId - The database ID of this sleep_period, if it exists.
 * @returns {HTMLElement} The sleep period element.
 */
function createSleepPeriodElement(dayId, initialLeftPercent, initialWidthPercent, periodId, dbId = null) {
    const sleepPeriod = document.createElement('div');
    sleepPeriod.className = 'sleepPeriod'; // Add this class for targeting
    sleepPeriod.style.left = `${initialLeftPercent}%`;
    sleepPeriod.style.width = `${initialWidthPercent}%`;
    // Ensure periods don't exceed 100% width from their start point
    if (parseFloat(sleepPeriod.style.left) + parseFloat(sleepPeriod.style.width) > 100) {
         sleepPeriod.style.width = `${100 - parseFloat(sleepPeriod.style.left)}%`;
         if (parseFloat(sleepPeriod.style.width) < 0) sleepPeriod.style.width = '0%'; // Should not happen with valid inputs
    }

    sleepPeriod.dataset.periodId = periodId; // Client-side sequential ID for the day
    if (dbId) sleepPeriod.dataset.dbId = dbId; // DB ID if loaded

    const timeline = document.getElementById(`timeline${dayId}`);

    const resizeStartHandle = document.createElement('div');
    resizeStartHandle.className = 'resizeHandle resizeStart';
    sleepPeriod.appendChild(resizeStartHandle);

    const resizeEndHandle = document.createElement('div');
    resizeEndHandle.className = 'resizeHandle resizeEnd';
    sleepPeriod.appendChild(resizeEndHandle);

    // Dragging the whole period
    sleepPeriod.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resizeHandle')) return;
        e.preventDefault(); e.stopPropagation(); activeDrags++;
        const initialLeftPx = sleepPeriod.offsetLeft;
        const dragStartX = e.clientX;
         const timelineWidth = timeline.offsetWidth;

        function onPeriodMove(moveEvent) {
            const deltaXPx = moveEvent.clientX - dragStartX;
            let newLeftPx = initialLeftPx + deltaXPx;
            // Clamp position within timeline bounds
            if (newLeftPx < 0) newLeftPx = 0;
            if (newLeftPx + sleepPeriod.offsetWidth > timelineWidth) {
                 newLeftPx = timelineWidth - sleepPeriod.offsetWidth;
            }

            sleepPeriod.style.left = `${(newLeftPx / timelineWidth) * 100}%`;
            updateStatistics(dayId, false);
        }
        function onPeriodMoveEnd() {
            document.removeEventListener('mousemove', onPeriodMove);
            document.removeEventListener('mouseup', onPeriodMoveEnd);
            activeDrags--;
            clearTimeout(saveTimeoutId);
            saveTimeoutId = setTimeout(() => {
                if (activeDrags === 0) {
                     console.log("All drags finished, triggering save for day:", dayId);
                    updateStatistics(dayId, true);
                }
            }, 100);
        }
        document.addEventListener('mousemove', onPeriodMove);
        document.addEventListener('mouseup', onPeriodMoveEnd);
    });

    // Resizing
    function addResizeFunctionality(handle, isStartHandle) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation(); activeDrags++;
            const resizeStartX = e.clientX;
            const initialPeriodLeftPx = sleepPeriod.offsetLeft;
            const initialPeriodWidthPx = sleepPeriod.offsetWidth;
             const timelineWidth = timeline.offsetWidth;

            function onPeriodResize(moveEvent) {
                const deltaXPx = moveEvent.clientX - resizeStartX;
                let newLeftPx = initialPeriodLeftPx;
                let newWidthPx = initialPeriodWidthPx;

                if (isStartHandle) {
                    newLeftPx = initialPeriodLeftPx + deltaXPx;
                    newWidthPx = initialPeriodWidthPx - deltaXPx;
                     // Clamp left and width
                    if (newLeftPx < 0) { newWidthPx += newLeftPx; newLeftPx = 0; }
                    if (newWidthPx < 5) newWidthPx = 5; // Min width 5px
                     // Ensure right edge doesn't go past initial right edge if pulling left
                    if (newLeftPx + newWidthPx > initialPeriodLeftPx + initialPeriodWidthPx && deltaXPx > 0) {
                         newLeftPx = initialPeriodLeftPx + initialPeriodWidthPx - newWidthPx;
                    }

                } else { // End handle
                    newWidthPx = initialPeriodWidthPx + deltaXPx;
                     // Clamp width and right edge
                    if (initialPeriodLeftPx + newWidthPx > timelineWidth) {
                        newWidthPx = timelineWidth - initialPeriodLeftPx;
                    }
                    if (newWidthPx < 5) newWidthPx = 5; // Min width 5px
                }

                 // Apply changes as percentages
                sleepPeriod.style.left = `${(newLeftPx / timelineWidth) * 100}%`;
                sleepPeriod.style.width = `${(newWidthPx / timelineWidth) * 100}%`;

                updateStatistics(dayId, false);
            }
            function onPeriodResizeEnd() {
                document.removeEventListener('mousemove', onPeriodResize);
                document.removeEventListener('mouseup', onPeriodResizeEnd);
                activeDrags--;
                clearTimeout(saveTimeoutId);
                saveTimeoutId = setTimeout(() => {
                    if (activeDrags === 0) {
                         console.log("All drags finished, triggering save for day:", dayId);
                        updateStatistics(dayId, true);
                    }
                }, 100);
            }
            document.addEventListener('mousemove', onPeriodResize);
            document.addEventListener('mouseup', onPeriodResizeEnd);
        });
    }
    addResizeFunctionality(resizeStartHandle, true);
    addResizeFunctionality(resizeEndHandle, false);
    return sleepPeriod;
}

function createNewSleepPeriodUI(dayId) {
    const timeline = document.getElementById(`timeline${dayId}`);
    if (!timeline) return;

    // Determine next period_id for this day (client-side index)
    const existingPeriods = timeline.querySelectorAll('.sleepPeriod');
    let maxPeriodId = 0;
     existingPeriods.forEach(p => {
         const pId = parseInt(p.dataset.periodId);
         if (!isNaN(pId) && pId > maxPeriodId) {
             maxPeriodId = pId;
         }
     });
    const nextPeriodId = maxPeriodId + 1;


    // Default position: start after the last period, or default to 6 AM (0.75 percent)
    let initialLeftPercent = 0.75 * 100; // Default start at 6 AM
    let initialWidthPercent = (2/24) * 100; // Default 2 hours duration

    if (existingPeriods.length > 0) {
        // Find the last period element based on its actual position (left %)
        const sortedPeriods = Array.from(existingPeriods).sort((a, b) => {
             const leftA = parseFloat(a.style.left);
             const leftB = parseFloat(b.style.left);
             return leftA - leftB; // Sort by start position
         });
        const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
        const lastPeriodLeft = parseFloat(lastPeriod.style.left);
        const lastPeriodWidth = parseFloat(lastPeriod.style.width);

        // Position the new period after the last one, with a small gap
        initialLeftPercent = lastPeriodLeft + lastPeriodWidth + 1; // 1% gap
        // Ensure the new period doesn't go off the right edge
        if (initialLeftPercent + initialWidthPercent > 100) {
             // If it goes off, wrap it to the beginning or position it at the end
             // Simple approach: just place it near the end if it exceeds 100%
             initialLeftPercent = 100 - initialWidthPercent;
        }
         if (initialLeftPercent < 0) initialLeftPercent = 0; // Should not happen with this logic but safety check
    }

    const sleepPeriodEl = createSleepPeriodElement(dayId, initialLeftPercent, initialWidthPercent, nextPeriodId);
    timeline.appendChild(sleepPeriodEl);

    updateStatistics(dayId, true); // Save after adding the new period
}

async function handleDeleteDayEntry(dayId) {
    const dayEntry = document.getElementById(`dayEntry${dayId}`);
    if (!dayEntry) return;

    const dbId = dayEntry.dataset.dbId; // Get the database ID

    if (dbId && currentUserId && supabase) {
        // Confirm deletion
        const confirmDelete = confirm(`Are you sure you want to delete Day ${dayId}? This cannot be undone.`);
        if (!confirmDelete) return;

        displayAuthMessage(`Deleting Day ${dayId}...`, "info");

        // Delete from sleep_periods first (if linked by record ID)
        // IMPORTANT: This assumes your sleep_periods table has a FK 'sleep_record_id'
        // and appropriate RLS policies to allow the user to delete their periods.
        const { error: periodsError } = await supabase
            .from('sleep_periods')
            .delete()
            .eq('sleep_record_id', dbId); // Use the sleep record ID

        if (periodsError) {
             console.error('Error deleting sleep periods for day:', dayId, periodsError);
             // Decide if you want to stop here or try to delete the record anyway
             displayAuthMessage('Error deleting sleep periods for day ' + dayId + ': ' + periodsError.message, 'error');
             return; // Stop if deleting periods failed
        }

        // Then delete the sleep_record entry
        const { error: recordError } = await supabase
            .from('sleep_record')
            .delete()
            .eq('id', dbId) // Delete by the record's primary key
            .eq('user_id', currentUserId); // Add user_id check for safety/RLS

        if (recordError) {
            console.error('Error deleting sleep record for day:', dayId, recordError);
            displayAuthMessage('Error deleting day ' + dayId + ': ' + recordError.message, 'error');
        } else {
            console.log('Day', dayId, 'and associated periods deleted successfully.');
            dayEntry.remove(); // Remove from UI
            updateGlobalStatistics(); // Recalculate global stats
            displayAuthMessage(`Day ${dayId} deleted successfully.`, "success");
             // No need to adjust localDayCounter downwards, it only increments
        }
    } else {
        // If it wasn't saved to DB, just remove from UI
        dayEntry.remove();
         updateGlobalStatistics();
         console.log("Removed unsaved day entry:", dayId);
    }
}


/**
 * Calculates and updates all display statistics for a given day.
 * Optionally triggers a save to the database.
 * @param {number} dayId - The day ID.
 * @param {boolean} shouldSave - Whether to save to Supabase after updating.
 */
function updateStatistics(dayId, shouldSave = false) {
    // Debounce save calls during active drags
    if (activeDrags > 0 && shouldSave) {
         // console.log("Drag in progress, deferring save for day:", dayId);
         // The save will be triggered by the timeout in onMouseUp/onPeriodMoveEnd
         return;
    }

    const dayEntry = document.getElementById(`dayEntry${dayId}`);
    if (!dayEntry) return;

    const timeline = document.getElementById(`timeline${dayId}`);
    const bedtimeMarker = document.getElementById(`bedtime${dayId}`);
    const wakeTimeMarker = document.getElementById(`wakeTime${dayId}`);
    const timeInBedEl = document.getElementById(`timeInBed${dayId}`);
    const totalSleepEl = document.getElementById(`totalSleep${dayId}`);
    const daySleepEfficiencyEl = document.getElementById(`daySleepEfficiency${dayId}`);
    const sleepQualitySlider = document.getElementById(`sleepQuality${dayId}`); // Need value for save
    const morningFatigueSlider = document.getElementById(`morningFatigue${dayId}`); // Need value for save


    if (!timeline || !bedtimeMarker || !wakeTimeMarker || !timeInBedEl || !totalSleepEl || !daySleepEfficiencyEl || !sleepQualitySlider || !morningFatigueSlider) {
         console.warn(`Elements for day ${dayId} not found for statistics update.`);
         return;
    }


    const timelineWidthPx = timeline.offsetWidth;
    if (timelineWidthPx === 0) {
         // console.warn(`Timeline width is 0px for day ${dayId}, skipping statistics update.`);
         return; // Avoid division by zero if not rendered yet
    }


    const bedtimePercent = bedtimeMarker.offsetLeft / timelineWidthPx;
    const wakeTimePercent = wakeTimeMarker.offsetLeft / timelineWidthPx;

    const tibHours = calculateHoursFromPercents(bedtimePercent, wakeTimePercent);
    timeInBedEl.textContent = tibHours.toFixed(1);

    let totalSleepHours = 0;
    const sleepPeriodElements = timeline.getElementsByClassName('sleepPeriod');
    for (const period of sleepPeriodElements) {
        const periodStartPercent = period.offsetLeft / timelineWidthPx;
         const periodEndPercent = (period.offsetLeft + period.offsetWidth) / timelineWidthPx;
        // Calculate duration based on percentage width (simplified for non-wrapping periods)
        const periodDurationHours = (period.offsetWidth / timelineWidthPx) * 24;
        totalSleepHours += periodDurationHours;
    }
    totalSleepEl.textContent = totalSleepHours.toFixed(1);

    let efficiency = 0;
    if (tibHours > 0.05) { // Avoid division by zero or near-zero TIB
        efficiency = (totalSleepHours / tibHours) * 100;
        if (efficiency > 100) efficiency = 100; // Cap at 100%
        if (efficiency < 0) efficiency = 0;
    }
    daySleepEfficiencyEl.textContent = efficiency.toFixed(0);

    // Also update quality/fatigue labels if input triggered this update
     const qualityLabel = document.getElementById(`sleepQualityLabel${dayId}`);
     const fatigueLabel = document.getElementById(`morningFatigueLabel${dayId}`);
     if (qualityLabel) qualityLabel.textContent = sleepQualitySlider.value;
     if (fatigueLabel) fatigueLabel.textContent = morningFatigueSlider.value;


    updateGlobalStatistics(); // Update overall averages displayed at the top

    if (shouldSave) {
         // Use a slight delay before saving to allow multiple updates (e.g., adding multiple periods quickly)
         clearTimeout(saveTimeoutId);
         saveTimeoutId = setTimeout(() => {
            if (activeDrags === 0) { // Only save if no drags are currently active
                saveSleepRecordToSupabase(dayId);
            } else {
                 console.log("Save for day", dayId, "deferred due to active drags.");
            }
         }, 200); // Wait 200ms before saving
    }
}

function updateGlobalStatistics() {
    let totalTIB = 0, totalSleep = 0, totalEfficiency = 0, totalSleepQuality = 0, totalMorningFatigue = 0;
    let validDaysCount = 0;
    const dayEntries = diaryDiv.querySelectorAll('.day');

    dayEntries.forEach(dayEntry => {
        const dayId = dayEntry.dataset.dayId;
        if (!dayId) return; // Skip if dayId is missing

        const tibEl = document.getElementById(`timeInBed${dayId}`);
        const sleepEl = document.getElementById(`totalSleep${dayId}`);
        const efficiencyEl = document.getElementById(`daySleepEfficiency${dayId}`);
        const qualityEl = document.getElementById(`sleepQuality${dayId}`);
        const fatigueEl = document.getElementById(`morningFatigue${dayId}`);

         if (!tibEl || !sleepEl || !efficiencyEl || !qualityEl || !fatigueEl) {
             console.warn(`Skipping global stats for day ${dayId} due to missing elements.`);
             return;
         }

        const tib = parseFloat(tibEl.textContent);
        const sleep = parseFloat(sleepEl.textContent);
        const efficiency = parseFloat(efficiencyEl.textContent);
        const quality = parseInt(qualityEl.value);
        const fatigue = parseInt(fatigueEl.value);

        if (!isNaN(tib) && !isNaN(sleep) && !isNaN(efficiency) && !isNaN(quality) && !isNaN(fatigue)) {
             // Only include days where all core stats could be calculated
            totalTIB += tib;
            totalSleep += sleep;
            totalEfficiency += efficiency;
            totalSleepQuality += quality;
            totalMorningFatigue += fatigue;
            validDaysCount++;
        } else {
             console.warn(`Skipping global stats for day ${dayId} due to invalid data (NaN).`);
        }
    });

    if (validDaysCount > 0) {
        // Ensure DOM elements exist before updating
        if (document.getElementById("avgTIB")) document.getElementById("avgTIB").textContent = (totalTIB / validDaysCount).toFixed(1);
        if (document.getElementById("avgSleep")) document.getElementById("avgSleep").textContent = (totalSleep / validDaysCount).toFixed(1);
        if (document.getElementById("avgSleepEfficiency")) document.getElementById("avgSleepEfficiency").textContent = (totalEfficiency / validDaysCount).toFixed(0);
        if (document.getElementById("avgSleepQuality")) document.getElementById("avgSleepQuality").textContent = (totalSleepQuality / validDaysCount).toFixed(1);
        if (document.getElementById("avgMorningFatigue")) document.getElementById("avgMorningFatigue").textContent = (totalMorningFatigue / validDaysCount).toFixed(1);
    } else {
        resetGlobalStatistics();
    }
}

function resetGlobalStatistics() {
    // Ensure DOM elements exist before resetting
    if (document.getElementById("avgTIB")) document.getElementById("avgTIB").textContent = '0';
    if (document.getElementById("avgSleep")) document.getElementById("avgSleep").textContent = '0';
    if (document.getElementById("avgSleepEfficiency")) document.getElementById("avgSleepEfficiency").textContent = '0';
    if (document.getElementById("avgSleepQuality")) document.getElementById("avgSleepQuality").textContent = '0';
    if (document.getElementById("avgMorningFatigue")) document.getElementById("avgMorningFatigue").textContent = '0';
}

async function saveSleepRecordToSupabase(dayId) {
    // CRITICAL CHECK: Ensure user is logged in before saving
    if (!currentUserId || !supabase) {
        console.error("Cannot save sleep record: User not logged in or Supabase client not initialized.");
         displayAuthMessage("Save failed: You are not logged in.", "error");
        return;
    }

    const dayEntryElement = document.getElementById(`dayEntry${dayId}`);
    if (!dayEntryElement) {
         console.error(`Cannot save sleep record: Day entry element not found for day ID ${dayId}.`);
        return;
    }

    const timeline = document.getElementById(`timeline${dayId}`);
    const bedtimeMarker = document.getElementById(`bedtime${dayId}`);
    const wakeTimeMarker = document.getElementById(`wakeTime${dayId}`);
     const sleepQualitySlider = document.getElementById(`sleepQuality${dayId}`);
     const morningFatigueSlider = document.getElementById(`morningFatigue${dayId}`);


    if (!timeline || !bedtimeMarker || !wakeTimeMarker || timeline.offsetWidth === 0 || !sleepQualitySlider || !morningFatigueSlider) {
         console.warn(`Elements for day ${dayId} not ready for save (timeline width 0 or markers/sliders missing).`);
        return;
    }

    const timelineWidthPx = timeline.offsetWidth;
    const bedtimePercent = bedtimeMarker.offsetLeft / timelineWidthPx;
    const wakeTimePercent = wakeTimeMarker.offsetLeft / timelineWidthPx;

     const dayCountInt = parseInt(dayId);
     if (isNaN(dayCountInt)) {
         console.error(`Invalid day ID "${dayId}" for saving.`);
         return;
     }

    const recordPayload = {
        user_id: currentUserId,
        day_count: dayCountInt, // Ensure day_count is an integer
        bedtime: percentToTimeStr(bedtimePercent),
        wake_time: percentToTimeStr(wakeTimePercent),
         // Retrieve calculated values from the UI spans
        time_in_bed: parseFloat(document.getElementById(`timeInBed${dayId}`).textContent),
        sleep_quality: parseInt(sleepQualitySlider.value),
        morning_fatigue: parseInt(morningFatigueSlider.value),
        // created_at and updated_at can be handled by Supabase (e.g. default now())
    };

     // Check for invalid calculated values before saving
     if (isNaN(recordPayload.time_in_bed) || isNaN(recordPayload.sleep_quality) || isNaN(recordPayload.morning_fatigue)) {
         console.error(`Calculated values for day ${dayId} are invalid, skipping save.`, recordPayload);
         displayAuthMessage(`Error: Invalid data calculated for Day ${dayId}. Save aborted.`, 'error');
         return;
     }

    // Get the existing database ID from the element if it exists
    let recordDbId = dayEntryElement.dataset.dbId;

    // Create the final payload for upsert
    const finalPayload = recordPayload;
    // If we have an existing DB ID for this record, add it to the payload
    // This tells upsert to try and update the row with this ID
    if (recordDbId) {
        // CORRECTION: DO NOT use parseInt() on a UUID. Pass the string UUID directly.
        finalPayload.id = recordDbId;
    }


    // Attempt to upsert the sleep_record
    const { data: savedRecord, error: recordError } = await supabase
        .from('sleep_record')
        // Use the prepared finalPayload
        // onConflict: 'user_id, day_count' ensures that if a record with the same user_id and day_count exists, it gets updated instead of inserting a duplicate.
        .upsert(finalPayload, { onConflict: 'user_id, day_count', ignoreDuplicates: false })
        .select('id') // Select the resulting ID to get the actual DB ID if it was inserted or updated
        .single();


    if (recordError) {
        console.error('Error saving sleep record:', recordError);
        // Check if the error is the FK violation for user_id (the previous error)
        if (recordError.code === '23503' && recordError.constraint === 'sleep_record_user_id_fkey') {
             displayAuthMessage('Save failed: User account issue. Please try logging out and back in.', 'error');
        } else {
             displayAuthMessage('Error saving day data: ' + recordError.message, 'error');
        }
    } else if (savedRecord && savedRecord.id) {
        const newRecordDbId = savedRecord.id;
        // Update the dataset attribute with the correct UUID returned by Supabase
        dayEntryElement.dataset.dbId = newRecordDbId;
        console.log(`Sleep record for day ${dayId} saved/updated with DB ID: ${newRecordDbId}`);
        // Now save the associated sleep periods, passing the correct UUID for the record
        await saveSleepPeriodsToSupabase(dayId, newRecordDbId);
         // Optional: Add a temporary visual confirmation
         dayEntryElement.classList.add('border-green-500');
         setTimeout(() => dayEntryElement.classList.remove('border-green-500'), 1000);
         displayAuthMessage("Sleep diary saved.", "success"); // Give success message after periods save
    } else {
         // This case should ideally not happen if upsert is successful and returns 'id'
         console.error("Upsert succeeded but did not return an ID for day", dayId);
         displayAuthMessage("Save completed, but could not retrieve record ID.", "warning");
    }
}

async function saveSleepPeriodsToSupabase(dayId, sleepRecordDbId) {
     // CRITICAL CHECK: Ensure user is logged in and record ID is available
    if (!currentUserId || !supabase || !sleepRecordDbId) {
        console.error("Cannot save sleep periods: User not logged in or sleep record ID is missing.");
        // Do not display auth message here, it's already handled by saveSleepRecordToSupabase
        return;
    }

    const timeline = document.getElementById(`timeline${dayId}`);
    if (!timeline || timeline.offsetWidth === 0) {
        console.warn(`Timeline width is 0px for day ${dayId}, skipping sleep periods save.`);
        return;
    }
    const timelineWidthPx = timeline.offsetWidth;

    // Delete existing periods for this sleep_record before inserting new ones.
    // This simplifies updates by replacing all periods for a given record.
    // IMPORTANT: This relies on your sleep_periods table having a FK 'sleep_record_id'.
    const { error: deleteError } = await supabase
        .from('sleep_periods')
        .delete()
        .eq('sleep_record_id', sleepRecordDbId); // Delete by the sleep_record's ID

    if (deleteError) {
        console.error('Error deleting old sleep periods for record', sleepRecordDbId, ':', deleteError);
        displayAuthMessage('Error saving sleep periods: Could not clear old data. ' + deleteError.message, 'error');
        // Decide if you want to stop or try to insert new ones anyway
        // return; // Uncomment to stop on delete failure
    }

    const sleepPeriodElements = timeline.querySelectorAll('.sleepPeriod');
    const periodsToSave = [];

    sleepPeriodElements.forEach(el => {
         // Calculate start/end percentages based on current element position and size
        const startPercent = el.offsetLeft / timelineWidthPx;
        const endPercent = (el.offsetLeft + el.offsetWidth) / timelineWidthPx; // End is start + width

         // Ensure percentages are within [0, 1] and handle wrap-around for duration calculation
         const startPercentNormalized = (startPercent % 1 + 1) % 1;
         const endPercentNormalized = (endPercent % 1 + 1) % 1;


        periodsToSave.push({
             // Link the period to the sleep_record
            sleep_record_id: sleepRecordDbId,
             // Include user_id and day_count if your sleep_periods table requires them (e.g., for RLS)
            user_id: currentUserId,
            day_count: parseInt(dayId), // Ensure day_count is an integer
             // Client-side sequential ID
            period_id: parseInt(el.dataset.periodId),
             // Store time strings calculated from percentage positions
            start_time: percentToTimeStr(startPercent),
            end_time: percentToTimeStr(endPercent),
             // Calculate and store the duration based on normalized percentages
            duration: calculateHoursFromPercents(startPercentNormalized, endPercentNormalized)
        });
    });

    if (periodsToSave.length > 0) {
         console.log(`Saving ${periodsToSave.length} sleep periods for record ${sleepRecordDbId}:`, periodsToSave);
        const { data, error: periodsError } = await supabase
            .from('sleep_periods')
            .insert(periodsToSave)
            .select('id, period_id'); // Select IDs and client-side period_ids for mapping

        if (periodsError) {
            console.error('Error saving sleep periods:', periodsError);
             displayAuthMessage('Error saving sleep periods: ' + periodsError.message, 'error');
        } else {
             console.log('Sleep periods saved successfully:', data);
             // Optional: Update DOM elements with new DB IDs if needed for future operations (like deleting individual periods)
             // This requires matching saved 'period_id' from the response back to DOM elements
             if (data && data.length > 0) {
                 data.forEach(savedPeriod => {
                     const el = timeline.querySelector(`.sleepPeriod[data-period-id="${savedPeriod.period_id}"]`);
                     if (el && savedPeriod.id) {
                         el.dataset.dbId = savedPeriod.id;
                     }
                 });
             }
        }
    } else {
        console.log(`No sleep periods to save for record ${sleepRecordDbId}.`);
         // If there were periods before but none now, the delete handled it.
         // If there were never any periods, this is fine.
    }
}


// --- Event Listeners ---
signupButton?.addEventListener("click", handleSignUp);
loginButton?.addEventListener("click", handleLogin);
logoutButton?.addEventListener("click", handleLogout);
addDayButton?.addEventListener("click", () => addDay()); // Add a new empty day

// --- Auth State Change Listener ---
supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event, session);
    // event can be 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'
    updateUserUI(session?.user); // session.user is null on SIGNED_OUT
});

// Initial check on page load
supabase.auth.getSession().then(({ data: { session } }) => {
    updateUserUI(session?.user);
});

// Ensure global stats are updated on page load even if not logged in initially (will reset to 0)
resetGlobalStatistics();
