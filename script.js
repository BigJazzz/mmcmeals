window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    const PROTEIN_MAP = { 'chicken': 'protein-chicken', 'beef': 'protein-beef', 'brisket': 'protein-beef', 'lamb': 'protein-lamb', 'pork': 'protein-pork', 'fish': 'protein-fish', 'salmon': 'protein-fish' };
    const PROTEIN_ORDER = [ 'protein-chicken', 'protein-beef', 'protein-lamb', 'protein-pork', 'protein-fish', 'protein-vegetarian' ];

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
    const mealListEl = document.getElementById('meal-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const importEmailButton = document.getElementById('import-email-button');
    const iosTabs = document.getElementById('ios-tabs');
    const uploadTabContent = document.getElementById('Upload');
    const listTabContent = document.getElementById('List');
    const undoBanner = document.getElementById('undo-banner');
    const undoButton = document.getElementById('undo-button');
    const progressBarInner = document.getElementById('progress-bar-inner');

    // --- APP STATE ---
    let meals = [];
    let lastUpdateTimestamp = null;
    let undoTimer;
    let pendingActions = [];

    // --- INITIALIZATION ---
    detectOS();
    loadMealsAndStartChecker();

    function getProteinTypes(mealName) {
        const lowerCaseName = mealName.toLowerCase();
        const foundProteins = [];
        for (const keyword in PROTEIN_MAP) {
            const index = lowerCaseName.indexOf(keyword);
            if (index !== -1) foundProteins.push({ className: PROTEIN_MAP[keyword], index });
        }
        if (foundProteins.length === 0) return ['protein-vegetarian'];
        foundProteins.sort((a, b) => a.index - b.index);
        return [...new Set(foundProteins.map(p => p.className))];
    }

    /**
     * MODIFIED: Handles consuming a meal, queueing the action, and showing the undo banner.
     */
    function consumeOneMeal(rowIndex) {
        const meal = meals.find(m => m.row === rowIndex);
        if (!meal || meal.remaining <= 0) return;

        meal.remaining--;
        pendingActions.push({ action: 'decrementQty', payload: { row: rowIndex } });
        
        // Don't re-render the whole list here, just update the specific tile's text
        const mealTile = document.getElementById(`meal-tile-${rowIndex}`);
        if(mealTile) {
            const qtySpan = mealTile.querySelector('.meal-qty');
            qtySpan.textContent = `(${meal.remaining} of ${meal.original} left)`;
            const checkbox = mealTile.querySelector('input[type="checkbox"]');
            checkbox.checked = true;
            checkbox.disabled = true;
        }

        showUndoBanner();
    }

    /**
     * NEW: Shows and manages the undo banner and its timer.
     */
    function showUndoBanner() {
        clearTimeout(undoTimer);
        document.getElementById('undo-message').textContent = `Consumed ${pendingActions.length} meal(s)`;
        
        // Reset and start the progress bar animation
        progressBarInner.style.transition = 'none';
        progressBarInner.style.width = '100%';
        void progressBarInner.offsetWidth; // Force CSS reflow
        progressBarInner.style.transition = 'width 5s linear';
        
        undoBanner.classList.add('visible');
        progressBarInner.style.width = '0%';

        undoTimer = setTimeout(() => {
            commitPendingActions();
            undoBanner.classList.remove('visible');
        }, 5000);
    }
    
    /**
     * NEW: Handles the "Undo" button click.
     */
    undoButton.addEventListener('click', () => {
        clearTimeout(undoTimer);
        
        pendingActions.forEach(action => {
            const meal = meals.find(m => m.row === action.payload.row);
            if (meal) meal.remaining++;
        });
        
        pendingActions = [];
        undoBanner.classList.remove('visible');
        renderMealList(); // Full re-render to restore state
    });

    /**
     * NEW: Sends all queued actions to the backend.
     */
    async function commitPendingActions() {
        if (pendingActions.length === 0) return;
        const actionsToCommit = [...pendingActions];
        pendingActions = [];

        try {
            for (const action of actionsToCommit) {
                await fetch(SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(action)
                });
            }
            await refreshMealList(); // Refresh from source of truth
        } catch (err) {
            console.error("Error committing actions:", err);
            alert("Could not save changes. Please try again.");
            await refreshMealList();
        }
    }

    /**
     * MODIFIED: Renders the list with protein group headers.
     */
    function renderMealList() {
        mealListEl.innerHTML = '';
        const availableMeals = meals.filter(m => m.remaining > 0);
        let currentGroup = null;

        if (availableMeals.length === 0) {
            mealListEl.innerHTML = '<p>No meals remaining. Time to import a new order!</p>';
        } else {
            availableMeals.forEach(meal => {
                const proteinClasses = getProteinTypes(meal.name);
                const primaryProtein = proteinClasses[0];

                // If this is a new protein group, add a header
                if (primaryProtein !== currentGroup) {
                    currentGroup = primaryProtein;
                    const header = document.createElement('h2');
                    header.className = 'protein-group-header';
                    // Format the name (e.g., "protein-chicken" -> "Chicken")
                    header.textContent = currentGroup.replace('protein-', '').replace(/^\w/, c => c.toUpperCase());
                    mealListEl.appendChild(header);
                }

                const li = document.createElement('li');
                li.id = `meal-tile-${meal.row}`; // Add ID for direct manipulation
                li.className = 'meal-item ' + proteinClasses.join(' ');

                if (proteinClasses.length > 1) {
                    const color1 = getComputedStyle(document.documentElement).getPropertyValue(`--${proteinClasses[0]}-color`).trim();
                    const color2 = getComputedStyle(document.documentElement).getPropertyValue(`--${proteinClasses[1]}-color`).trim();
                    if (color1 && color2) li.style.background = `linear-gradient(to right, ${color1}, ${color2})`;
                }
                
                li.innerHTML = `
                    <input type="checkbox" id="meal-${meal.row}">
                    <label for="meal-${meal.row}">
                        <span class="meal-name">${meal.name}</span>
                        <span class="meal-qty">(${meal.remaining} of ${meal.original} left)</span>
                    </label>
                `;
                
                li.querySelector('input').addEventListener('change', () => {
                    consumeOneMeal(meal.row);
                });
                mealListEl.appendChild(li);
            });
        }
        updateMealCounter(availableMeals.length);
    }
    
    // --- Other functions (no major changes below) ---

    async function refreshMealList() {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getMeals`);
            if (!response.ok) throw new Error(`Network response was not ok`);
            let fetchedMeals = await response.json();

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

    async function loadMealsAndStartChecker() {
        await refreshMealList();
        const tsResponse = await fetch(`${SCRIPT_URL}?action=getLastUpdate`);
        const tsData = await tsResponse.json();
        lastUpdateTimestamp = tsData.lastUpdate;
        setInterval(async () => {
            if (pendingActions.length > 0) return; // Don't check for updates if an undo is pending
            try {
                const response = await fetch(`${SCRIPT_URL}?action=getLastUpdate`);
                const data = await response.json();
                if (lastUpdateTimestamp && data.lastUpdate !== lastUpdateTimestamp) {
                    lastUpdateTimestamp = data.lastUpdate;
                    await refreshMealList();
                }
            } catch (err) { console.error("Error checking for updates:", err); }
        }, 60000);
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
            if (result.status === 'success') await refreshMealList();
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
};
