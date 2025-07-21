window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
    const mealListEl = document.getElementById('meal-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const importEmailButton = document.getElementById('import-email-button');
    const importTabButton = document.getElementById('import-tab-button');
    const iosTabs = document.getElementById('ios-tabs');
    const uploadTabContent = document.getElementById('Upload');
    const listTabContent = document.getElementById('List');

    // --- APP STATE ---
    let meals = [];
    const consumedToday = new Set();
    let autoRefreshTimer;

    // --- INITIALIZATION ---
    detectOS();
    loadMealsFromSheet();

    // --- AUTO-REFRESH LOGIC ---
    function resetAutoRefreshTimer() {
        clearTimeout(autoRefreshTimer);
        const sixHoursInMillis = 6 * 60 * 60 * 1000;
        autoRefreshTimer = setTimeout(loadMealsFromSheet, sixHoursInMillis);
    }

    // --- OS DETECTION & UI SETUP ---
    /**
     * MODIFIED: This function now correctly handles the initial visibility
     * of tabs for all devices.
     */
    function detectOS() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;

        if (/android/i.test(userAgent)) {
            // On Android, hide the tabs and the import functionality.
            iosTabs.style.display = 'none';
            uploadTabContent.style.display = 'none';
        } else {
            // On other devices (iOS, Desktop), show the tab bar and default to the List view.
            iosTabs.classList.remove('hidden');
            listTabContent.classList.remove('hidden');
            uploadTabContent.classList.add('hidden');
        }
    }
    
    // --- TAB SWITCHING LOGIC ---
    /**
     * MODIFIED: This function now uses CSS classes for a more robust show/hide mechanism.
     */
    window.openTab = (evt, tabName) => {
        // Hide all tab content by adding the 'hidden' class
        const tabcontent = document.getElementsByClassName("tab-content");
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].classList.add('hidden');
        }

        // Deactivate all tab links
        const tablinks = document.getElementsByClassName("tab-link");
        for (let i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }

        // Show the current tab's content by removing the 'hidden' class and activate its button
        document.getElementById(tabName).classList.remove('hidden');
        evt.currentTarget.className += " active";
    };

    // --- DATA & UI FUNCTIONS --- (No changes below this line)
    async function loadMealsFromSheet() {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getMeals`);
            if (!response.ok) throw new Error(`Network response was not ok`);
            meals = await response.json();
            renderMealList();
        } catch (err) {
            console.error("Error loading meals:", err);
            alert("Could not load meals from the backend.");
        } finally {
            setLoading(false);
            resetAutoRefreshTimer();
        }
    }

    function renderMealList() {
        mealListEl.innerHTML = '';
        const availableMeals = meals.filter(m => m.remaining > 0);

        if (availableMeals.length === 0) {
            mealListEl.innerHTML = '<p>No meals remaining. Time to import a new order!</p>';
        } else {
            availableMeals.forEach(meal => {
                const li = document.createElement('li');
                li.className = 'meal-item';
                const isConsumed = consumedToday.has(meal.row);

                li.innerHTML = `
                    <input type="checkbox" id="meal-${meal.row}" ${isConsumed ? 'checked disabled' : ''}>
                    <label for="meal-${meal.row}">
                        ${meal.name} <span class="meal-qty">(${meal.remaining}/${meal.original})</span>
                    </label>
                `;
                
                if (!isConsumed) {
                    li.querySelector('input').addEventListener('change', () => {
                        consumeOneMeal(meal.row);
                    });
                }
                mealListEl.appendChild(li);
            });
        }
        updateMealCounter(availableMeals.length);
    }

    async function consumeOneMeal(rowIndex) {
        consumedToday.add(rowIndex);
        const meal = meals.find(m => m.row === rowIndex);
        if (meal) meal.remaining--;
        renderMealList();

        resetAutoRefreshTimer();

        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'decrementQty',
                    payload: { row: rowIndex }
                })
            });

            setTimeout(() => {
                consumedToday.delete(rowIndex);
                renderMealList();
            }, 10000);

        } catch (err) {
            console.error("Error decrementing quantity:", err);
            alert("Could not update meal count. Please refresh.");
            consumedToday.delete(rowIndex);
            if (meal) meal.remaining++;
            renderMealList();
        }
    }

    function updateMealCounter(count) {
        mealCounterEl.textContent = count;
        if (count <= 5) {
            mealCounterEl.classList.add('alert');
        } else {
            mealCounterEl.classList.remove('alert');
        }
    }

    // --- EVENT LISTENERS ---
    importEmailButton.addEventListener('click', async () => {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=importFromGmail`);
            const result = await response.json();
            alert(result.message);
            if (result.status === 'success') {
                await loadMealsFromSheet();
            }
        } catch (err) {
            console.error("Error triggering email import:", err);
            alert("A client-side error occurred while importing from email.");
        } finally {
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        loadingSpinner.style.display = isLoading ? 'block' : 'none';
        mealListEl.style.display = isLoading ? 'none' : 'grid';
    }
};
