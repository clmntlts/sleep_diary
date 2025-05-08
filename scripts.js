// --- Supabase Initialization ---
// IMPORTANT: Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = "https://wvdggsrxtjdlfezenbbz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZGdnc3J4dGpkbGZlemVuYmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwNDc5NDcsImV4cCI6MjA1NTYyMzk0N30.4hJtANpuD5xx_J0Ukk6QoqTcnbV0gkjMeD2HcP5QxB8";

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
        if (diaryDiv) diaryDiv.innerHTML = '';
        resetGlobalStatistics();
        localDayCounter = 0;
    }
}

// --- Diary Core Logic ---

/**
 * Adds a new day entry to the UI.
 * If recordData is provided, it populates the day with that data (used when loading from DB).
 * @param {object|null} recordData - Optional data to populate the new day (from sleep_record table).
 */
function addDay(recordData = null) {
    const dayNumber = recordData ? recordData.day_count : ++localDayCounter;
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
    if (recordData && recordData.sleep_periods && timelineDiv) {
        recordData.sleep_periods.forEach(periodData => {
            const startPercent = timeStrToPercent(periodData.start_time);
            const endPercent = timeStrToPercent(periodData.end_time);
            // Duration from DB is source of truth, but width needs to be calculated from start/end for UI
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
    const parent = element.parentElement;
    if (!element || !parent) { activeDrags--; return; }

    const parentRect = parent.getBoundingClientRect();
    let shiftX = event.clientX - element.getBoundingClientRect().left;

    function onMouseMove(moveEvent) {
        let newLeftPx = moveEvent.clientX - shiftX - parentRect.left;
        if (newLeftPx < 0) newLeftPx = 0;
        const maxLeftPx = parent.offsetWidth - element.offsetWidth;
        if (newLeftPx > maxLeftPx) newLeftPx = maxLeftPx;
        element.style.left = newLeftPx + 'px';
        updateStatistics(dayId, false); // Update UI but don't save on every mouse move
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        activeDrags--;
        if (activeDrags === 0) {
            updateStatistics(dayId, true); // Final update and save
        }
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function updateSleepQuality(dayId) {
    const qualitySlider = document.getElementById(`sleepQuality${dayId}`);
    const qualityLabel = document.getElementById(`sleepQualityLabel${dayId}`);
    if (qualitySlider && qualityLabel) qualityLabel.textContent = qualitySlider.value;
    updateStatistics(dayId, true);
}

function updateMorningFatigue(dayId) {
    const fatigueSlider = document.getElementById(`morningFatigue${dayId}`);
    const fatigueLabel = document.getElementById(`morningFatigueLabel${dayId}`);
    if (fatigueSlider && fatigueLabel) fatigueLabel.textContent = fatigueSlider.value;
    updateStatistics(dayId, true);
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
    sleepPeriod.className = 'sleepPeriod';
    sleepPeriod.style.left = `${initialLeftPercent}%`;
    sleepPeriod.style.width = `${initialWidthPercent}%`;
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

        function onPeriodMove(moveEvent) {
            const deltaXPx = moveEvent.clientX - dragStartX;
            let newLeftPx = initialLeftPx + deltaXPx;
            if (newLeftPx < 0) newLeftPx = 0;
            if (newLeftPx + sleepPeriod.offsetWidth > timeline.offsetWidth) {
                newLeftPx = timeline.offsetWidth - sleepPeriod.offsetWidth;
            }
            sleepPeriod.style.left = `${newLeftPx}px`;
            updateStatistics(dayId, false);
        }
        function onPeriodMoveEnd() {
            document.removeEventListener('mousemove', onPeriodMove);
            document.removeEventListener('mouseup', onPeriodMoveEnd);
            activeDrags--; if (activeDrags === 0) updateStatistics(dayId, true);
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

            function onPeriodResize(moveEvent) {
                const deltaXPx = moveEvent.clientX - resizeStartX;
                let newLeftPx = initialPeriodLeftPx;
                let newWidthPx = initialPeriodWidthPx;

                if (isStartHandle) {
                    newLeftPx = initialPeriodLeftPx + deltaXPx;
                    newWidthPx = initialPeriodWidthPx - deltaXPx;
                    if (newLeftPx < 0) { newWidthPx += newLeftPx; newLeftPx = 0; }
                    if (newWidthPx < 5) newWidthPx = 5; // Min width 5px
                     // Prevent crossing over right edge
                    if (newLeftPx + newWidthPx > initialPeriodLeftPx + initialPeriodWidthPx && deltaXPx > 0) {
                         newLeftPx = initialPeriodLeftPx + initialPeriodWidthPx - newWidthPx;
                    }
                } else { // End handle
                    newWidthPx = initialPeriodWidthPx + deltaXPx;
                    if (initialPeriodLeftPx + newWidthPx > timeline.offsetWidth) {
                        newWidthPx = timeline.offsetWidth - initialPeriodLeftPx;
                    }
                    if (newWidthPx < 5) newWidthPx = 5;
                }
                sleepPeriod.style.left = `${newLeftPx}px`;
                sleepPeriod.style.width = `${newWidthPx}px`;
                updateStatistics(dayId, false);
            }
            function onPeriodResizeEnd() {
                document.removeEventListener('mousemove', onPeriodResize);
                document.removeEventListener('mouseup', onPeriodResizeEnd);
                activeDrags--; if (activeDrags === 0) updateStatistics(dayId, true);
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

    // Determine next period_id for this day
    const existingPeriods = timeline.querySelectorAll('.sleepPeriod');
    const nextPeriodId = existingPeriods.length + 1;

    // Default to a 2-hour period in the middle of the timeline or after the last period
    let initialLeftPercent = 0.4 * 100; // 40%
    let initialWidthPercent = (2/24) * 100; // 2 hours

    if (existingPeriods.length > 0) {
        const lastPeriod = existingPeriods[existingPeriods.length - 1];
        const lastPeriodLeft = parseFloat(lastPeriod.style.left);
        const lastPeriodWidth = parseFloat(lastPeriod.style.width);
        initialLeftPercent = lastPeriodLeft + lastPeriodWidth + 1; // 1% gap
        if (initialLeftPercent + initialWidthPercent > 100) {
            initialLeftPercent = 100 - initialWidthPercent;
        }
         if (initialLeftPercent < 0) initialLeftPercent = 0;
    }


    const sleepPeriodEl = createSleepPeriodElement(dayId, initialLeftPercent, initialWidthPercent, nextPeriodId);
    timeline.appendChild(sleepPeriodEl);
    updateStatistics(dayId, true); // Save after adding
}


/**
 * Calculates and updates all display statistics for a given day.
 * Optionally triggers a save to the database.
 * @param {number} dayId - The day ID.
 * @param {boolean} shouldSave - Whether to save to Supabase after updating.
 */
function updateStatistics(dayId, shouldSave = false) {
    if (activeDrags > 0 && shouldSave) {
        // console.log("Drag in progress, deferring save for day:", dayId);
        return; // Don't save if a drag is still active on this or another element
    }

    const dayEntry = document.getElementById(`dayEntry${dayId}`);
    if (!dayEntry) return;

    const timeline = document.getElementById(`timeline${dayId}`);
    const bedtimeMarker = document.getElementById(`bedtime${dayId}`);
    const wakeTimeMarker = document.getElementById(`wakeTime${dayId}`);
    const timeInBedEl = document.getElementById(`timeInBed${dayId}`);
    const totalSleepEl = document.getElementById(`totalSleep${dayId}`);
    const daySleepEfficiencyEl = document.getElementById(`daySleepEfficiency${dayId}`);

    if (!timeline || !bedtimeMarker || !wakeTimeMarker || !timeInBedEl || !totalSleepEl || !daySleepEfficiencyEl) return;

    const timelineWidthPx = timeline.offsetWidth;
    if (timelineWidthPx === 0) return; // Avoid division by zero if not rendered

    const bedtimePercent = bedtimeMarker.offsetLeft / timelineWidthPx;
    const wakeTimePercent = wakeTimeMarker.offsetLeft / timelineWidthPx;

    const tibHours = calculateHoursFromPercents(bedtimePercent, wakeTimePercent);
    timeInBedEl.textContent = tibHours.toFixed(1);

    let totalSleepHours = 0;
    const sleepPeriodElements = timeline.getElementsByClassName('sleepPeriod');
    for (const period of sleepPeriodElements) {
        const periodStartPercent = period.offsetLeft / timelineWidthPx;
        const periodWidthPercent = period.offsetWidth / timelineWidthPx;
        // For duration, it's simpler: width is duration if it doesn't wrap.
        // Our periods are single blocks, so their width directly translates to duration.
        totalSleepHours += periodWidthPercent * 24;
    }
    totalSleepEl.textContent = totalSleepHours.toFixed(1);

    let efficiency = 0;
    if (tibHours > 0.05) { // Avoid division by zero or near-zero TIB
        efficiency = (totalSleepHours / tibHours) * 100;
        if (efficiency > 100) efficiency = 100; // Cap at 100%
        if (efficiency < 0) efficiency = 0;
    }
    daySleepEfficiencyEl.textContent = efficiency.toFixed(0);

    updateGlobalStatistics(); // Update overall averages displayed at the top

    if (shouldSave && currentUserId && supabase) {
        saveSleepRecordToSupabase(dayId);
    }
}

function updateGlobalStatistics() {
    let totalTIB = 0, totalSleep = 0, totalEfficiency = 0, totalSleepQuality = 0, totalMorningFatigue = 0;
    let validDaysCount = 0;
    const dayEntries = diaryDiv.querySelectorAll('.day');

    dayEntries.forEach(dayEntry => {
        const dayId = dayEntry.dataset.dayId;
        if (!dayId) return;
        const tib = parseFloat(document.getElementById(`timeInBed${dayId}`)?.textContent);
        const sleep = parseFloat(document.getElementById(`totalSleep${dayId}`)?.textContent);
        const efficiency = parseFloat(document.getElementById(`daySleepEfficiency${dayId}`)?.textContent);
        const quality = parseInt(document.getElementById(`sleepQuality${dayId}`)?.value);
        const fatigue = parseInt(document.getElementById(`morningFatigue${dayId}`)?.value);

        if (![tib, sleep, efficiency, quality, fatigue].some(isNaN)) {
            totalTIB += tib;
            totalSleep += sleep;
            totalEfficiency += efficiency;
            totalSleepQuality += quality;
            totalMorningFatigue += fatigue;
            validDaysCount++;
        }
    });

    if (validDaysCount > 0) {
        document.getElementById("avgTIB").textContent = (totalTIB / validDaysCount).toFixed(1);
        document.getElementById("avgSleep").textContent = (totalSleep / validDaysCount).toFixed(1);
        document.getElementById("avgSleepEfficiency").textContent = (totalEfficiency / validDaysCount).toFixed(0);
        document.getElementById("avgSleepQuality").textContent = (totalSleepQuality / validDaysCount).toFixed(1);
        document.getElementById("avgMorningFatigue").textContent = (totalMorningFatigue / validDaysCount).toFixed(1);
    } else {
        resetGlobalStatistics();
    }
}

function resetGlobalStatistics() {
    document.getElementById("avgTIB").textContent = '0';
    document.getElementById("avgSleep").textContent = '0';
    document.getElementById("avgSleepEfficiency").textContent = '0';
    document.getElementById("avgSleepQuality").textContent = '0';
    document.getElementById("avgMorningFatigue").textContent = '0';
}

// --- Supabase Data Persistence ---
async function saveSleepRecordToSupabase(dayId) {
    if (!currentUserId || !supabase) return;
    const dayEntryElement = document.getElementById(`dayEntry${dayId}`);
    if (!dayEntryElement) return;

    const timeline = document.getElementById(`timeline${dayId}`);
    const bedtimeMarker = document.getElementById(`bedtime${dayId}`);
    const wakeTimeMarker = document.getElementById(`wakeTime${dayId}`);
    if (!timeline || !bedtimeMarker || !wakeTimeMarker || timeline.offsetWidth === 0) return;

    const timelineWidthPx = timeline.offsetWidth;
    const bedtimePercent = bedtimeMarker.offsetLeft / timelineWidthPx;
    const wakeTimePercent = wakeTimeMarker.offsetLeft / timelineWidthPx;

    const recordPayload = {
        user_id: currentUserId,
        day_count: parseInt(dayId),
        bedtime: percentToTimeStr(bedtimePercent),
        wake_time: percentToTimeStr(wakeTimePercent),
        time_in_bed: parseFloat(document.getElementById(`timeInBed${dayId}`).textContent),
        sleep_quality: parseInt(document.getElementById(`sleepQuality${dayId}`).value),
        morning_fatigue: parseInt(document.getElementById(`morningFatigue${dayId}`).value),
        // created_at and updated_at can be handled by Supabase (e.g. default now())
    };

    let recordDbId = dayEntryElement.dataset.dbId;
    if (recordDbId) recordPayload.id = parseInt(recordDbId); // Include ID if updating

    const { data: savedRecord, error: recordError } = await supabase
        .from('sleep_record')
        .upsert(recordPayload, { onConflict: 'user_id, day_count', ignoreDuplicates: false }) // Assumes unique constraint on (user_id, day_count) or use PK if available
        .select('id')
        .single();

    if (recordError) {
        console.error('Error saving sleep record:', recordError);
        displayAuthMessage('Error saving day data: ' + recordError.message, 'error');
    } else if (savedRecord && savedRecord.id) {
        dayEntryElement.dataset.dbId = savedRecord.id; // Store/update the DB ID
        // console.log(`Sleep record for day ${dayId} saved/updated with DB ID: ${savedRecord.id}`);
        await saveSleepPeriodsToSupabase(dayId, savedRecord.id); // Save associated periods
    }
}

async function saveSleepPeriodsToSupabase(dayId, sleepRecordDbId) {
    if (!currentUserId || !supabase || !sleepRecordDbId) return;

    const timeline = document.getElementById(`timeline${dayId}`);
    if (!timeline || timeline.offsetWidth === 0) return;
    const timelineWidthPx = timeline.offsetWidth;

    // Delete existing periods for this sleep_record (identified by user_id and day_count, or sleepRecordDbId)
    // Simpler to use sleepRecordDbId if your sleep_periods table had a direct FK.
    // Given current schema, linking by user_id and day_count.
    const { error: deleteError } = await supabase
        .from('sleep_periods')
        .delete()
        .eq('user_id', currentUserId)
        .eq('day_count', parseInt(dayId));

    if (deleteError) {
        console.error('Error deleting old sleep periods:', deleteError);
        // Decide if you want to stop or try to insert new ones anyway
    }

    const sleepPeriodElements = timeline.querySelectorAll('.sleepPeriod');
    const periodsToSave = [];
    sleepPeriodElements.forEach(el => {
        const startPercent = el.offsetLeft / timelineWidthPx;
        const endPercent = (el.offsetLeft + el.offsetWidth) / timelineWidthPx; // End is start + width

        periodsToSave.push({
            user_id: currentUserId,
            day_count: parseInt(dayId),
            period_id: parseInt(el.dataset.periodId), // Client-side sequential ID
            start_time: percentToTimeStr(startPercent),
            end_time: percentToTimeStr(endPercent),
            duration: calculateHoursFromPercents(startPercent, endPercent)
            // id: if this period was loaded, el.dataset.dbId might exist.
            // For upsert, you'd include it. For delete-then-insert, it's not needed for insert.
        });
    });

    if (periodsToSave.length > 0) {
        const { data, error: periodsError } = await supabase.from('sleep_periods').insert(periodsToSave).select('id, period_id');
        if (periodsError) {
            console.error('Error saving sleep periods:', periodsError);
        } else {
            // console.log('Sleep periods saved:', data);
            // Optional: update dataset.dbId on each sleep period element if needed for fine-grained updates later
            data.forEach(savedP => {
                const el = timeline.querySelector(`.sleepPeriod[data-period-id="${savedP.period_id}"]`);
                if (el) el.dataset.dbId = savedP.id;
            });
        }
    }
}

async function loadUserData() {
    if (!supabase || !currentUserId) return;
    displayAuthMessage("Loading your sleep diary...", "info");

    const { data: records, error } = await supabase
        .from('sleep_record')
        .select(`
            *,
            sleep_periods (*)
        `)
        .eq('user_id', currentUserId)
        .order('day_count', { ascending: false }); // Load newest first

    if (error) {
        console.error('Error loading user data:', error);
        displayAuthMessage('Error loading your data: ' + error.message, 'error');
        return;
    }

    if (diaryDiv) diaryDiv.innerHTML = ''; // Clear existing entries
    localDayCounter = 0; // Reset counter

    if (records && records.length > 0) {
        records.forEach(record => {
            addDay(record); // addDay will handle populating UI and setting localDayCounter
        });
        displayAuthMessage("Diary loaded.", "success");
    } else {
        displayAuthMessage("No sleep entries found. Add your first day!", "info");
        // Optionally add a blank day 1 if no records
        // addDay();
    }
    updateGlobalStatistics();
}

async function handleDeleteDayEntry(dayId) {
    if (!confirm(`Are you sure you want to delete Day ${dayId}? This action cannot be undone.`)) return;

    const dayEntryElement = document.getElementById(`dayEntry${dayId}`);
    const sleepRecordDbId = dayEntryElement?.dataset.dbId;

    if (sleepRecordDbId && supabase && currentUserId) {
        // Delete associated sleep periods first (based on user_id and day_count)
        const { error: periodError } = await supabase.from('sleep_periods')
            .delete()
            .eq('user_id', currentUserId)
            .eq('day_count', parseInt(dayId));

        if (periodError) {
            console.error(`Error deleting sleep periods for day ${dayId}:`, periodError);
            displayAuthMessage('Error deleting associated sleep periods: ' + periodError.message, 'error');
            // Optionally stop here or proceed to delete the main record
        }

        // Then delete the main sleep record
        const { error: recordError } = await supabase.from('sleep_record').delete().eq('id', sleepRecordDbId);
        if (recordError) {
            console.error(`Error deleting sleep record ${sleepRecordDbId} from database:`, recordError);
            displayAuthMessage('Error deleting day record: ' + recordError.message, 'error');
            return; // Don't remove from UI if DB delete failed
        }
    }

    if (dayEntryElement) {
        dayEntryElement.remove();
        updateGlobalStatistics(); // Recalculate global stats
        displayAuthMessage(`Day ${dayId} deleted.`, "success");
    }
     // Adjust localDayCounter if the deleted day was the highest
    const remainingDayEntries = diaryDiv.querySelectorAll('.day');
    let maxDayNum = 0;
    remainingDayEntries.forEach(entry => {
        const num = parseInt(entry.dataset.dayId);
        if (num > maxDayNum) maxDayNum = num;
    });
    localDayCounter = maxDayNum;
}


// --- Event Listeners Setup ---
document.addEventListener('DOMContentLoaded', () => {
    if (!supabase) {
        console.error("Supabase client failed to initialize. App will not function correctly.");
        updateUserUI(null); // Show logged-out state
        if(addDayButton) addDayButton.disabled = true;
        return;
    }

    signupButton?.addEventListener('click', handleSignUp);
    loginButton?.addEventListener('click', handleLogin);
    logoutButton?.addEventListener('click', handleLogout);
    addDayButton?.addEventListener('click', () => addDay()); // Add a new blank day

    // Listen to auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
        // console.log("Auth event:", event, session);
        const user = session?.user ?? null;
        updateUserUI(user);
        if (event === 'SIGNED_OUT') {
            if (diaryDiv) diaryDiv.innerHTML = '';
            resetGlobalStatistics();
            localDayCounter = 0;
        } else if (event === 'SIGNED_IN') {
            // loadUserData is called within updateUserUI if user is present
        }
    });

    // Check initial auth state in case user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
        const user = session?.user ?? null;
        updateUserUI(user);
        if (!user && addDayButton) { // Ensure add day button is disabled if no initial session
            addDayButton.disabled = true;
        }
    }).catch(error => {
        console.error("Error getting initial session:", error);
        updateUserUI(null);
         if(addDayButton) addDayButton.disabled = true;
    });
});
