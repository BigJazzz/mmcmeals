window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
    const mealListEl = document.getElementById('meal-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const importEmailButton = document.getElementById('import-email-button');
    const iosTabs = document.getElementById('ios-tabs');
    const uploadTabContent = document.getElementById('Upload');

    // --- APP STATE ---
    let meals = [];
    const consumedToday = new Set();
    let autoRefreshTimer; // Timer for the 6-hour auto-refresh

    // --- INITIALIZATION ---
    detectOS();
    loadMealsFromSheet();

    // --- AUTO-REFRESH LOGIC ---
    /**
     * Resets the 6-hour timer that automatically refreshes the meal list.
     * This is called on page load and after every user interaction.
     */
    function resetAutoRefreshTimer() {
        clearTimeout(autoRefreshTimer); // Clear any existing timer
        const sixHoursInMillis = 6 * 60 * 60 * 1000;
        autoRefreshTimer = setTimeout(loadMealsFromSheet, sixHoursInMillis);
    }

    // --- OS DETECTION & UI SETUP ---
    function detectOS() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            iosTabs.classList.remove('hidden');
            uploadTabContent.classList.add('hidden');
            document.getElementById('Upload').style.display = 'none';
            document.getElementById('List').style.display = 'block';
        } else {
            uploadTabContent.classList.remove('hidden');
        }
    }

    // --- DATA & UI FUNCTIONS ---
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
            resetAutoRefreshTimer(); // Start the 6-hour timer after the list loads
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

    /**
     * Handles consuming a meal, with a 10-second timeout
     * to re-enable the checkbox. Also resets the auto-refresh timer.
     */
    async function consumeOneMeal(rowIndex) {
        // Immediately update the UI to show the meal as consumed
        consumedToday.add(rowIndex);
        const meal = meals.find(m => m.row === rowIndex);
        if (meal) meal.remaining--;
        renderMealList();

        // Reset the 6-hour refresh timer on user interaction
        resetAutoRefreshTimer();

        try {
            // Send the update to the Google Sheet
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'decrementQty',
                    payload: { row: rowIndex }
                })
            });

            // If successful, start the 10-second timeout to re-enable the checkbox
            setTimeout(() => {
                consumedToday.delete(rowIndex);
                renderMealList(); // Re-render the list to show the updated, enabled item
            }, 10000); // 10 seconds

        } catch (err) {
            console.error("Error decrementing quantity:", err);
            alert("Could not update meal count. Please refresh.");
            // If the backend fails, immediately revert the UI changes
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
                await loadMealsFromSheet(); // Refresh the list
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
    
    // --- TAB SWITCHING LOGIC ---
    window.openTab = (evt, tabName) => {
        const tabcontent = document.getElementsByClassName("tab-content");
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        const tablinks = document.getElementsByClassName("tab-link");
        for (let i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    };
};
