window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    const PROTEIN_MAP = { 'chicken': 'protein-chicken', 'beef': 'protein-beef', 'brisket': 'protein-beef', 'lamb': 'protein-lamb', 'pork': 'protein-pork', 'fish': 'protein-fish', 'salmon': 'protein-fish' };
    const PROTEIN_ORDER = [ 'protein-chicken', 'protein-beef', 'protein-lamb', 'protein-pork', 'protein-fish', 'protein-vegetarian' ];

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
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

    // --- Assignment Logic ---
    function renderAssignmentList() {
        assignmentListEl.innerHTML = '';
        const mealsToAssign = meals.filter(m => m.total > 0);
        const unassigned = mealsToAssign.filter(m => (m.jarryd + m.nathan) !== m.total);
        const assigned = mealsToAssign.filter(m => (m.jarryd + m.nathan) === m.total);

        const createAssignmentItem = (meal, isComplete) => {
            const li = document.createElement('li');
            li.className = 'assignment-item';
            if (isComplete) li.classList.add('assigned-complete');
            li.dataset.row = meal.row;
            li.dataset.total = meal.total;
            li.innerHTML = `
                <span>${meal.name} (${meal.total})</span>
                <div class="assignment-inputs">
                    <label>J:</label> <input type="number" class="assign-jarryd" min="0" max="${meal.total}" value="${meal.jarryd}">
                    <label>N:</label> <input type="number" class="assign-nathan" min="0" max="${meal.total}" value="${meal.nathan}">
                </div>`;
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
            let nathanVal = parseInt(nathanInput.value, 10) || 0;
            if (e.target.classList.contains('assign-jarryd')) {
                if (jarrydVal > total) jarrydVal = total;
                if (jarrydVal < 0) jarrydVal = 0;
                jarrydInput.value = jarrydVal;
                nathanInput.value = total - jarrydVal;
            } else {
                if (nathanVal > total) nathanVal = total;
                if (nathanVal < 0) nathanVal = 0;
                nathanInput.value = nathanVal;
                jarrydInput.value = total - nathanVal;
            }
            const meal = meals.find(m => m.row == li.dataset.row);
            if(meal) {
                meal.jarryd = parseInt(jarrydInput.value);
                meal.nathan = parseInt(nathanInput.value);
            }
            if ((parseInt(jarrydInput.value) + parseInt(nathanInput.value)) === total) {
                setTimeout(renderAssignmentList, 400);
            } else {
                li.classList.remove('assigned-complete');
            }
        }
    });

    saveAssignmentsButton.addEventListener('click', async () => {
        const payload = [];
        document.querySelectorAll('#assignment-list .assignment-item').forEach(li => {
            payload.push({
                row: li.dataset.row,
                jarryd: li.querySelector('.assign-jarryd').value,
                nathan: li.querySelector('.assign-nathan').value
            });
        });
        setLoading(true);
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'saveAssignments', payload })
            });
            await refreshMealList();
            alert('Assignments saved!');
        } catch (err) {
            alert('Error saving assignments.');
        } finally {
            setLoading(false);
        }
    });
    
    // --- Main Rendering and Data Logic ---
    function consumeMeal(rowIndex, person) {
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
                ${meal.jarryd > 0 ? `<button class="consumer-btn consume-jarryd">J</button>` : ''}
                ${meal.nathan > 0 ? `<button class="consumer-btn consume-nathan">N</button>` : ''}`;
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
        const availableMeals = meals.filter(m => (m.jarryd + m.nathan) > 0);
        
        if (availableMeals.length === 0) {
            mealListEl.innerHTML = '<p>No meals remaining. Time to import a new order!</p>';
            updateMealCounter(0);
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
                    li.querySelectorAll('.consumer-btn').forEach(btn => {
                        btn.addEventListener('click', () => consumeMeal(meal.row, btn.dataset.person));
                    });
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
        updateMealCounter(availableMeals.reduce((sum, m) => sum + m.jarryd + m.nathan, 0));
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
        for (let i = 0; i < tabcontent.length; i++) tabcontent[i].classList.add('hidden');
        const tablinks = document.getElementsByClassName("tab-link");
        for (let i = 0; i < tablinks.length; i++) tablinks[i].className = tablinks[i].className.replace(" active", "");
        document.getElementById(tabName).classList.remove('hidden');
        evt.currentTarget.className += " active";
    };
};
