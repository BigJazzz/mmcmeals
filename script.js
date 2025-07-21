window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    const mealCounterEl = document.getElementById('meal-counter');
    const mealListEl = document.getElementById('meal-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const importEmailButton = document.getElementById('import-email-button');
    const iosTabs = document.getElementById('ios-tabs');
    const uploadTabContent = document.getElementById('Upload');
    const listTabContent = document.getElementById('List');

    let meals = [];
    const consumedToday = new Set();
    let autoRefreshTimer;
    let lastUpdateTimestamp = null; // NEW: Track the last known update time

    detectOS();
    loadMealsFromSheet();

    /**
     * NEW: Checks for updates every 10 seconds.
     */
    function startUpdateChecker() {
        setInterval(async () => {
            try {
                const response = await fetch(`${SCRIPT_URL}?action=getLastUpdate`);
                const data = await response.json();
                if (lastUpdateTimestamp && data.lastUpdate !== lastUpdateTimestamp) {
                    // If the timestamp is different, reload the whole list
                    loadMealsFromSheet();
                }
                // Store the latest timestamp
                lastUpdateTimestamp = data.lastUpdate;
            } catch (err) {
                console.error("Error checking for updates:", err);
            }
        }, 60000); // Check every 10 seconds
    }

    function resetAutoRefreshTimer() {
        clearTimeout(autoRefreshTimer);
        const sixHoursInMillis = 6 * 60 * 60 * 1000;
        autoRefreshTimer = setTimeout(loadMealsFromSheet, sixHoursInMillis);
    }

    function detectOS() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/android/i.test(userAgent)) {
            iosTabs.style.display = 'none';
            uploadTabContent.style.display = 'none';
        } else {
            iosTabs.classList.remove('hidden');
            listTabContent.classList.remove('hidden');
            uploadTabContent.classList.add('hidden');
        }
    }
    
    window.openTab = (evt, tabName) => {
        const tabcontent = document.getElementsByClassName("tab-content");
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].classList.add('hidden');
        }
        const tablinks = document.getElementsByClassName("tab-link");
        for (let i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).classList.remove('hidden');
        evt.currentTarget.className += " active";
    };

    async function loadMealsFromSheet() {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getMeals`);
            if (!response.ok) throw new Error(`Network response was not ok`);
            meals = await response.json();
            renderMealList();
            // After the first successful load, start checking for updates
            if (lastUpdateTimestamp === null) {
                startUpdateChecker();
            }
        } catch (err) {
            console.error("Error loading meals:", err);
            alert("Could not load meals from the backend.");
        } finally {
            setLoading(false);
            resetAutoRefreshTimer();
        }
    }

    function renderMealList() {
        const availableMeals = meals.filter(m => m.remaining > 0);
        mealListEl.innerHTML = availableMeals.length ? '' : '<p>No meals remaining. Time to import a new order!</p>';
        availableMeals.forEach(meal => {
            const li = document.createElement('li');
            const proteinClasses = getProteinTypes(meal.name);
            li.className = 'meal-item ' + proteinClasses.join(' ');
            if (proteinClasses.length > 1) {
                const color1 = getComputedStyle(document.documentElement).getPropertyValue(`--${proteinClasses[0]}-color`).trim();
                const color2 = getComputedStyle(document.documentElement).getPropertyValue(`--${proteinClasses[1]}-color`).trim();
                if (color1 && color2) li.style.background = `linear-gradient(to right, ${color1}, ${color2})`;
            }
            const isConsumed = consumedToday.has(meal.row);
            li.innerHTML = `
                <input type="checkbox" id="meal-${meal.row}" ${isConsumed ? 'checked disabled' : ''}>
                <label for="meal-${meal.row}">
                    <span class="meal-name">${meal.name}</span>
                    <span class="meal-qty">(${meal.remaining} of ${meal.original} left)</span>
                </label>`;
            if (!isConsumed) {
                li.querySelector('input').addEventListener('change', () => consumeOneMeal(meal.row));
            }
            mealListEl.appendChild(li);
        });
        updateMealCounter(availableMeals.length);
    }
    
    async function consumeOneMeal(rowIndex) {
        consumedToday.add(rowIndex);
        const meal = meals.find(m => m.row === rowIndex);
        if (meal) meal.remaining--;
        renderMealList();
        resetAutoRefreshTimer();
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'decrementQty', payload: { row: rowIndex } })
            });
            const data = await response.json();
            lastUpdateTimestamp = data.lastUpdate; // Update timestamp after successful consumption
            setTimeout(() => {
                consumedToday.delete(rowIndex);
                renderMealList();
            }, 10000);
        } catch (err) {
            consumedToday.delete(rowIndex);
            if (meal) meal.remaining++;
            renderMealList();
        }
    }
    
    function getProteinTypes(mealName) {
        const lowerCaseName = mealName.toLowerCase();
        const types = new Set();
        if (lowerCaseName.includes('beef') || lowerCaseName.includes('brisket')) types.add('protein-beef');
        if (lowerCaseName.includes('chicken')) types.add('protein-chicken');
        if (lowerCaseName.includes('lamb')) types.add('protein-lamb');
        if (lowerCaseName.includes('pork')) types.add('protein-pork');
        if (lowerCaseName.includes('fish') || lowerCaseName.includes('salmon')) types.add('protein-fish');
        if (types.size === 0) types.add('protein-other');
        return Array.from(types);
    }

    function updateMealCounter(count) {
        mealCounterEl.textContent = count;
        mealCounterEl.classList.toggle('alert', count <= 5);
    }

    importEmailButton.addEventListener('click', async () => {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=importFromGmail`);
            const result = await response.json();
            alert(result.message);
            if (result.status === 'success') loadMealsFromSheet();
        } catch (err) {
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
