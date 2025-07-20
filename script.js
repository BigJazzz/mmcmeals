window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
    const mealListEl = document.getElementById('meal-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const importEmailButton = document.getElementById('import-email-button');
    // Keep other elements if you still use them (PDF upload, tabs, etc.)

    // --- APP STATE ---
    let meals = [];
    const consumedToday = new Set(); // Track meals consumed in this session

    // --- INITIALIZATION ---
    loadMealsFromSheet();

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
        // Optimistically update UI
        consumedToday.add(rowIndex);
        const meal = meals.find(m => m.row === rowIndex);
        if (meal) meal.remaining--;
        renderMealList();

        // Send update to the backend
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'decrementQty',
                    payload: { row: rowIndex }
                })
            });
        } catch (err) {
            console.error("Error decrementing quantity:", err);
            alert("Could not update meal count. Please refresh.");
            // Revert optimistic update on failure
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
};
