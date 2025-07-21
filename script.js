window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    // Define the protein keywords and their corresponding CSS classes
    const PROTEIN_MAP = {
        'chicken': 'protein-chicken',
        'beef': 'protein-beef',
        'brisket': 'protein-beef',
        'lamb': 'protein-lamb',
        'pork': 'protein-pork',
        'fish': 'protein-fish',
        'salmon': 'protein-fish'
    };
    // Define the desired order for protein groups
    const PROTEIN_ORDER = [ 'protein-chicken', 'protein-beef', 'protein-lamb', 'protein-pork', 'protein-fish', 'protein-vegetarian' ];

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
    const mealListEl = document.getElementById('meal-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const importEmailButton = document.getElementById('import-email-button');
    const iosTabs = document.getElementById('ios-tabs');
    const uploadTabContent = document.getElementById('Upload');
    const listTabContent = document.getElementById('List');

    // --- APP STATE ---
    let meals = [];
    const consumedToday = new Set();
    let lastUpdateTimestamp = null;

    // --- INITIALIZATION ---
    detectOS();
    loadMealsAndStartChecker(); // Initial data load

    /**
     * Finds which protein keyword appears first in the name for accurate sorting.
     */
    function getProteinTypes(mealName) {
        const lowerCaseName = mealName.toLowerCase();
        const foundProteins = [];

        for (const keyword in PROTEIN_MAP) {
            const index = lowerCaseName.indexOf(keyword);
            if (index !== -1) {
                foundProteins.push({ className: PROTEIN_MAP[keyword], index: index });
            }
        }

        if (foundProteins.length === 0) {
            return ['protein-vegetarian'];
        }

        foundProteins.sort((a, b) => a.index - b.index);
        const uniqueClassNames = [...new Set(foundProteins.map(p => p.className))];
        return uniqueClassNames;
    }

    // --- OS DETECTION & UI SETUP ---
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
    
    // --- TAB SWITCHING LOGIC ---
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

    // --- DATA & UI FUNCTIONS ---
    /**
     * Fetches and sorts the full meal list.
     */
    async function refreshMealList() {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getMeals`);
            if (!response.ok) throw new Error(`Network response was not ok`);
            let fetchedMeals = await response.json();

            // Sorting logic is applied here
            fetchedMeals.sort((a, b) => {
                const aProteins = getProteinTypes(a.name);
                const bProteins = getProteinTypes(b.name);
                const aRank = PROTEIN_ORDER.indexOf(aProteins[0]);
                const bRank = PROTEIN_ORDER.indexOf(bProteins[0]);

                if (aRank !== bRank) return aRank - bRank;
                return a.name.localeCompare(b.name);
            });

            meals = fetchedMeals;
            renderMealList();
        } catch (err) {
            console.error("Error loading meals:", err);
            alert("Could not load meals from the backend.");
        } finally {
            setLoading(false);
        }
    }

    /**
     * Initial load and starts the periodic checker.
     */
    async function loadMealsAndStartChecker() {
        await refreshMealList(); // Perform the initial load and sort

        // Get the initial timestamp
        const tsResponse = await fetch(`${SCRIPT_URL}?action=getLastUpdate`);
        const tsData = await tsResponse.json();
        lastUpdateTimestamp = tsData.lastUpdate;

        // Start checking for updates every 60 seconds
        setInterval(async () => {
            try {
                const response = await fetch(`${SCRIPT_URL}?action=getLastUpdate`);
                const data = await response.json();
                if (lastUpdateTimestamp && data.lastUpdate !== lastUpdateTimestamp) {
                    lastUpdateTimestamp = data.lastUpdate;
                    await refreshMealList(); // Reload if timestamp has changed
                }
            } catch (err) {
                console.error("Error checking for updates:", err);
            }
        }, 60000);
    }

    function renderMealList() {
        mealListEl.innerHTML = '';
        const availableMeals = meals.filter(m => m.remaining > 0);

        if (availableMeals.length === 0) {
            mealListEl.innerHTML = '<p>No meals remaining. Time to import a new order!</p>';
        } else {
            availableMeals.forEach(meal => {
                const li = document.createElement('li');
                const proteinClasses = getProteinTypes(meal.name);
                li.className = 'meal-item ' + proteinClasses.join(' ');

                if (proteinClasses.length > 1) {
                    const colorVar1 = `--${proteinClasses[0]}-color`;
                    const colorVar2 = `--${proteinClasses[1]}-color`;
                    const color1 = getComputedStyle(document.documentElement).getPropertyValue(colorVar1).trim();
                    const color2 = getComputedStyle(document.documentElement).getPropertyValue(colorVar2).trim();
                    if (color1 && color2) {
                        li.style.background = `linear-gradient(to right, ${color1}, ${color2})`;
                    }
                }
                
                const isConsumed = consumedToday.has(meal.row);
                li.innerHTML = `
                    <input type="checkbox" id="meal-${meal.row}" ${isConsumed ? 'checked disabled' : ''}>
                    <label for="meal-${meal.row}">
                        <span class="meal-name">${meal.name}</span>
                        <span class="meal-qty">(${meal.remaining} of ${meal.original} left)</span>
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

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'decrementQty', payload: { row: rowIndex } })
            });
            const data = await response.json();
            // After consumption, update the local timestamp to prevent an immediate unnecessary refresh
            if (data.status === 'success') {
                const tsResponse = await fetch(`${SCRIPT_URL}?action=getLastUpdate`);
                const tsData = await tsResponse.json();
                lastUpdateTimestamp = tsData.lastUpdate;
            }
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
        mealCounterEl.classList.toggle('alert', count <= 5);
    }

    // --- EVENT LISTENERS & HELPERS ---
    importEmailButton.addEventListener('click', async () => {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=importFromGmail`);
            const result = await response.json();
            alert(result.message);
            if (result.status === 'success') {
                await refreshMealList(); // Use the main refresh function
            }
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
