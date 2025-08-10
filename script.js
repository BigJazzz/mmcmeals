window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    const PROTEIN_MAP = { 'chicken': 'protein-chicken', 'bolognese': 'protein-beef', 'beef': 'protein-beef', 'brisket': 'protein-beef', 'lamb': 'protein-lamb', 'pork': 'protein-pork', 'fish': 'protein-fish', 'salmon': 'protein-fish' };
    const PROTEIN_ORDER = [ 'protein-vegetarian', 'protein-lamb', 'protein-pork', 'protein-fish', 'protein-chicken', 'protein-beef' ];

    // --- DOM ELEMENTS ---
    const blackoutScreen = document.getElementById('blackout-screen');
    const blackoutButton = document.getElementById('blackout-button');
    const mealCounterEl = document.getElementById('meal-counter');
    const jarrydCounterEl = document.getElementById('jarryd-counter');
    const nathanCounterEl = document.getElementById('nathan-counter');
    const mealListEl = document.getElementById('meal-list');
    const assignmentListEl = document.getElementById('assignment-list');
    const saveAssignmentsButton = document.getElementById('save-assignments-button');
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
    let currentFilter = 'all';

    // --- INITIALIZATION ---
    detectOS();
    addFilterEventListeners();
    setupBlackoutButton();
    loadMealsAndStartChecker();

    // --- Blackout Logic ---
    function setupBlackoutButton() {
        if (window.Android) {
            blackoutButton.classList.remove('hidden');
            blackoutButton.addEventListener('click', () => {
                window.Android.toggleBlackout();
            });
        }
    }

    function toggleBlackout(isBlackedOut) {
        blackoutScreen.classList.toggle('hidden', !isBlackedOut);
    }
    window.toggleBlackout = toggleBlackout;


    function addFilterEventListeners() {
        jarrydCounterEl.addEventListener('click', () => { currentFilter = (currentFilter === 'jarryd') ? 'all' : 'jarryd'; renderMealList(); });
        nathanCounterEl.addEventListener('click', () => { currentFilter = (currentFilter === 'nathan') ? 'all' : 'nathan'; renderMealList(); });
        mealCounterEl.addEventListener('click', () => { currentFilter = 'all'; renderMealList(); });
    }

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
    
    // --- LOCAL CACHING ---
    function saveAssignmentsToLocal() {
        localStorage.setItem('pendingMealAssignments', JSON.stringify(meals));
    }

    // --- Assignment Logic ---
    function renderAssignmentList() {
        assignmentListEl.innerHTML = '';
        const mealsToAssign = meals.filter(m => m.total > 0);
        const unassigned = mealsToAssign.filter(m => (m.jarryd + m.nathan) < m.total);
        const assigned = mealsToAssign.filter(m => (m.jarryd + m.nathan) === m.total);

        const createAssignmentItem = (meal, isComplete) => {
            const li = document.createElement('li');
            li.className = 'assignment-item';
            if (isComplete) li.classList.add('assigned-complete');
            li.dataset.row = meal.row;
            li.dataset.total = meal.total;
            const unassignedQty = meal.total - (meal.jarryd + meal.nathan);

            li.innerHTML = `
                <span class="assignment-name">${meal.name}</span>
                <div class="assignment-controls">
                    <div class="assignment-counts">
                        <span class="assignment-counts-unassigned">${unassignedQty}</span>
                        <span class="assignment-counts-total"> of ${meal.total}</span>
                    </div>
                    <div class="assignment-inputs">
                        <label>J:</label> <input type="number" class="assign-jarryd" min="0" max="${meal.total}" value="${meal.jarryd}">
                        <label>N:</label> <input type="number" class="assign-nathan" min="0" max="${meal.total}" value="${meal.nathan}">
                    </div>
                </div>
                <button class="save-line-button">Save</button>
            `;
            return li;
        };
        unassigned.forEach(meal => assignmentListEl.appendChild(createAssignmentItem(meal, false)));
        assigned.forEach(meal => assignmentListEl.appendChild(createAssignmentItem(meal, true)));
    }
    
    assignmentListEl.addEventListener('input', e => {
        if (e.target.matches('.assign-jarryd, .assign-nathan')) {
            const li = e.target.closest('.assignment-item');
            const total = parseInt(li.dataset.total, 10);
            const jarrydInput = li.querySelector('.assign-jarryd');
            const nathanInput = li.querySelector('.assign-nathan');
            let jarrydVal = parseInt(jarrydInput.value, 10) || 0;

            if (jarrydVal < 0) jarrydVal = 0;
            if (jarrydVal > total) jarrydVal = total;
            
            jarrydInput.value = jarrydVal;
            nathanInput.value = total - jarrydVal;
            
            const unassignedSpan = li.querySelector('.assignment-counts-unassigned');
            unassignedSpan.textContent = total - (parseInt(jarrydInput.value) + parseInt(nathanInput.value));
        }
    });

    /**
     * MODIFIED: Correctly updates both the assignment list and the main meal list.
     */
    assignmentListEl.addEventListener('click', e => {
        if (e.target.classList.contains('save-line-button')) {
            const li = e.target.closest('.assignment-item');
            const meal = meals.find(m => m.row == li.dataset.row);
            if (meal) {
                meal.jarryd = parseInt(li.querySelector('.assign-jarryd').value, 10);
                meal.nathan = parseInt(li.querySelector('.assign-nathan').value, 10);
                saveAssignmentsToLocal();
                e.target.textContent = 'Saved!';
                setTimeout(() => { e.target.textContent = 'Save'; }, 1500);
                
                // Re-render both lists to reflect the changes
                renderAssignmentList();
                renderMealList();
            }
        }
    });

    saveAssignmentsButton.addEventListener('click', async () => {
        const payload = meals.map(m => ({ row: m.row, jarryd: m.jarryd, nathan: m.nathan }));
        
        saveAssignmentsButton.disabled = true;
        saveAssignmentsButton.textContent = 'Uploading...';
        
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'saveAssignments', payload })
            });
            localStorage.removeItem('pendingMealAssignments');
            await refreshMealList();
            alert('All assignments have been uploaded to the spreadsheet!');
        } catch (err) {
            alert('Error uploading assignments. Your changes are still saved locally.');
        } finally {
            saveAssignmentsButton.disabled = false;
            saveAssignmentsButton.textContent = 'Upload All Assignments';
        }
    });
    
    // --- Main Rendering and Data Logic ---
    function consumeMeal(rowIndex, person) {
        if (pendingActions.length > 0) return;
        const meal = meals.find(m => m.row === rowIndex);
        if (!meal) return;
        const personQty = person.toLowerCase() === 'jarryd' ? meal.jarryd : meal.nathan;
        if (personQty <= 0) return;
        if (person.toLowerCase() === 'jarryd') meal.jarryd--;
        else meal.nathan--;
        pendingActions.push({ action: 'decrementPersonQty', payload: { row: rowIndex, person: person.toLowerCase() } });
        const mealTile = document.getElementById(`meal-tile-${rowIndex}`);
        if(mealTile) {
            const oldButtons = mealTile.querySelector('.consumer-buttons');
            const newButtons = document.createElement('div');
            newButtons.className = 'consumer-buttons';
            newButtons.innerHTML = `
                ${meal.jarryd > 0 ? `<button class="consumer-btn consume-jarryd" data-person="jarryd">J</button>` : ''}
                ${meal.nathan > 0 ? `<button class="consumer-btn consume-nathan" data-person="nathan">N</button>` : ''}`;
            oldButtons.replaceWith(newButtons);
            mealTile.querySelector('.consume-jarryd')?.addEventListener('click', () => consumeMeal(meal.row, 'jarryd'));
            mealTile.querySelector('.consume-nathan')?.addEventListener('click', () => consumeMeal(meal.row, 'nathan'));
            const qtySpan = mealTile.querySelector('.meal-qty');
            qtySpan.textContent = `J: ${meal.jarryd}, N: ${meal.nathan}`;
        }
        showUndoBanner();
    }

    function showUndoBanner() {
        clearTimeout(undoTimer);
        document.getElementById('undo-message').textContent = `Consumed ${pendingActions.length} meal(s)`;
        progressBarInner.style.transition = 'none';
        progressBarInner.style.width = '100%';
        void progressBarInner.offsetWidth;
        progressBarInner.style.transition = 'width 5s linear';
        undoBanner.classList.add('visible');
        progressBarInner.style.width = '0%';
        undoTimer = setTimeout(() => {
            commitPendingActions();
            undoBanner.classList.remove('visible');
        }, 5000);
    }
    
    undoButton.addEventListener('click', () => {
        clearTimeout(undoTimer);
        pendingActions.forEach(action => {
            const meal = meals.find(m => m.row === action.payload.row);
            if (meal) {
                if (action.payload.person === 'jarryd') meal.jarryd++;
                else meal.nathan++;
            }
        });
        pendingActions = [];
        undoBanner.classList.remove('visible');
        renderMealList();
    });

    async function commitPendingActions() {
        if (pendingActions.length > 0) return;
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
            await refreshMealList();
        } catch (err) {
            console.error("Error committing actions:", err);
            alert("Could not save changes. Please try again.");
            await refreshMealList();
        }
    }

    async function refreshMealList() {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getMeals`);
            if (!response.ok) {
                throw new Error(`Network response was not ok, status: ${response.status}`);
            }

            const responseData = await response.json();
            console.log("Full response from backend:", responseData); // Log the full response

            // Check if the response has a 'data' property that is an array
            if (responseData && Array.isArray(responseData.data)) {
                fetchedMeals = responseData.data;
            } 
            // Check if the response itself is an array
            else if (Array.isArray(responseData)) {
                fetchedMeals = responseData;
            } 
            // If it's neither, the format is unexpected
            else {
                throw new Error("Received unexpected data format from backend.");
            }

            const localData = localStorage.getItem('pendingMealAssignments');
            if (localData) {
                const localMeals = JSON.parse(localData);
                const localMap = new Map(localMeals.map(m => [m.row, m]));
                fetchedMeals.forEach(meal => {
                    if (localMap.has(meal.row)) {
                        const local = localMap.get(meal.row);
                        meal.jarryd = local.jarryd;
                        meal.nathan = local.nathan;
                    }
                });
            }
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
            renderAssignmentList();
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
            if (pendingActions.length > 0) return;
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
    
    function renderMealList() {
        mealListEl.innerHTML = '';
        let filteredMeals = meals;
        if (currentFilter === 'jarryd') filteredMeals = meals.filter(m => m.jarryd > 0);
        else if (currentFilter === 'nathan') filteredMeals = meals.filter(m => m.nathan > 0);
        const availableMeals = filteredMeals.filter(m => (m.jarryd + m.nathan) > 0);
        
        if (availableMeals.length === 0) {
            mealListEl.innerHTML = `<p>No meals found for the current filter.</p>`;
            updateMealCounter(meals);
            return;
        }

        const groups = {};
        availableMeals.forEach(meal => {
            const primaryProtein = getProteinTypes(meal.name)[0];
            if (!groups[primaryProtein]) groups[primaryProtein] = [];
            groups[primaryProtein].push(meal);
        });

        const column1 = document.createElement('div');
        const column2 = document.createElement('div');
        let i = 0;
        for (const groupName of PROTEIN_ORDER) {
            if (groups[groupName]) {
                const groupContainer = document.createElement('div');
                groupContainer.className = 'protein-group-container';
                const header = document.createElement('h2');
                header.className = 'protein-group-header';
                header.textContent = groupName.replace('protein-', '').replace(/^\w/, c => c.toUpperCase());
                groupContainer.appendChild(header);
                const mealGrid = document.createElement('div');
                mealGrid.className = 'protein-meal-grid';
                
                groups[groupName].forEach(meal => {
                    const li = document.createElement('li');
                    const proteinClasses = getProteinTypes(meal.name);
                    li.id = `meal-tile-${meal.row}`;
                    li.className = 'meal-item ' + proteinClasses.join(' ');
                    if (proteinClasses.length > 1) {
                        const color1 = getComputedStyle(document.documentElement).getPropertyValue(`--${proteinClasses[0]}-color`).trim();
                        const color2 = getComputedStyle(document.documentElement).getPropertyValue(`--${proteinClasses[1]}-color`).trim();
                        if (color1 && color2) li.style.background = `linear-gradient(to right, ${color1}, ${color2})`;
                    }
                    li.innerHTML = `
                        <div class="consumer-buttons">
                            ${meal.jarryd > 0 ? `<button class="consumer-btn consume-jarryd" data-person="jarryd">J</button>` : ''}
                            ${meal.nathan > 0 ? `<button class="consumer-btn consume-nathan" data-person="nathan">N</button>` : ''}
                        </div>
                        <label>
                            <span class="meal-name">${meal.name}</span>
                            <span class="meal-qty">J: ${meal.jarryd}, N: ${meal.nathan}</span>
                        </label>`;
                    li.querySelectorAll('.consumer-btn').forEach(btn => btn.addEventListener('click', () => consumeMeal(meal.row, btn.dataset.person)));
                    mealGrid.appendChild(li);
                });
                groupContainer.appendChild(mealGrid);
                if (i % 2 === 0) column1.appendChild(groupContainer);
                else column2.appendChild(groupContainer);
                i++;
            }
        }
        mealListEl.appendChild(column1);
        mealListEl.appendChild(column2);
        updateMealCounter(meals);
    }
    
    function updateMealCounter(mealList) {
        const jarrydTotal = mealList.reduce((sum, m) => sum + m.jarryd, 0);
        const nathanTotal = mealList.reduce((sum, m) => sum + m.nathan, 0);
        const grandTotal = jarrydTotal + nathanTotal;
        jarrydCounterEl.textContent = `J ${jarrydTotal}`;
        nathanCounterEl.textContent = `N ${nathanTotal}`;
        mealCounterEl.textContent = grandTotal;
        mealCounterEl.classList.toggle('alert', grandTotal <= 5);
        jarrydCounterEl.classList.toggle('filter-active', currentFilter === 'jarryd');
        nathanCounterEl.classList.toggle('filter-active', currentFilter === 'nathan');
        mealCounterEl.classList.toggle('filter-active', currentFilter === 'all');
    }

    importEmailButton.addEventListener('click', async () => {
        importEmailButton.disabled = true;
        importEmailButton.textContent = 'Checking...';
        setLoading(true);
        try {
            const checkResponse = await fetch(`${SCRIPT_URL}?action=checkLastEmail`);
            const checkResult = await checkResponse.json();
            let proceed = false;
            if (checkResult.status === 'confirmation_needed') {
                if (confirm(checkResult.message)) proceed = true;
            } else if (checkResult.status === 'no_new_email') {
                alert('No new unread meal emails found.');
            } else {
                proceed = true;
            }
            if (proceed) {
                importEmailButton.textContent = 'Importing...';
                const importResponse = await fetch(`${SCRIPT_URL}?action=importFromGmail`);
                const importResult = await importResponse.json();
                alert(importResult.message);
                if (importResult.status === 'success') await refreshMealList();
            }
        } catch (err) {
            alert("A client-side error occurred during the import process.");
        } finally {
            importEmailButton.disabled = false;
            importEmailButton.textContent = 'Import from Email';
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
        for (let i = 0; i < tabcontent.length; i++) tabcontent[i].classList.add('hidden');
        const tablinks = document.getElementsByClassName("tab-link");
        for (let i = 0; i < tablinks.length; i++) tablinks[i].className = tablinks[i].className.replace(" active", "");
        document.getElementById(tabName).classList.remove('hidden');
        evt.currentTarget.className += " active";
    };
};