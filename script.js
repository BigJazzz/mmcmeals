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
        } catch
