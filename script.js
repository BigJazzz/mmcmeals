window.onload = () => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv4lTtqAyle1X5-inx5FUmUXoXpAMGVr0wVGpFZgus0IOB_MEDvV11JcQKa325RLbf/exec';

    const PROTEIN_MAP = { 'chicken': 'protein-chicken', 'beef': 'protein-beef', 'brisket': 'protein-beef', 'lamb': 'protein-lamb', 'pork': 'protein-pork', 'fish': 'protein-fish', 'salmon': 'protein-fish' };
    const PROTEIN_ORDER = [ 'protein-chicken', 'protein-beef', 'protein-lamb', 'protein-pork', 'protein-fish', 'protein-vegetarian' ];

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
    const jarrydCounterEl = document.getElementById('jarryd-counter');
    const nathanCounterEl = document.getElementById('nathan-counter');
    const mealListEl = document.getElementById('meal-list');
    // ... (rest of DOM elements are the same)
    
    // --- MODIFIED: This function now calculates and updates all three counters ---
    function updateMealCounter(availableMeals) {
        const jarrydTotal = availableMeals.reduce((sum, m) => sum + m.jarryd, 0);
        const nathanTotal = availableMeals.reduce((sum, m) => sum + m.nathan, 0);
        const grandTotal = jarrydTotal + nathanTotal;

        jarrydCounterEl.textContent = `J ${jarrydTotal}`;
        nathanCounterEl.textContent = `N ${nathanTotal}`;
        mealCounterEl.textContent = grandTotal;

        mealCounterEl.classList.toggle('alert', grandTotal <= 5);
    }
    
    /**
     * MODIFIED: Renders the list and passes the correct data to updateMealCounter.
     */
    function renderMealList() {
        mealListEl.innerHTML = '';
        const availableMeals = meals.filter(m => (m.jarryd + m.nathan) > 0);
        
        if (availableMeals.length === 0) {
            mealListEl.innerHTML = '<p>No meals remaining. Time to import a new order!</p>';
            // Call counter with empty array to set counts to 0
            updateMealCounter([]);
            return;
        }

        // ... (grouping and rendering logic is the same) ...

        updateMealCounter(availableMeals); // Pass the filtered array to the counter
    }

    // ... The rest of your script.js file is correct and does not need to be changed ...
};
