window.onload = () => {
    // --- CONFIGURATION ---
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwqEAM17_m21V5hT2K9wuc2swieBYRJVjQl-mI9KcaMPUBmnMULvjvC6WDChknkfhT7/exec';

    // --- DOM ELEMENTS ---
    const mealCounterEl = document.getElementById('meal-counter');
    const mealListEl = document.getElementById('meal-list');
    const authContainer = document.getElementById('auth-container');
    const mealListContainer = document.getElementById('meal-list-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const pdfUploadInput = document.getElementById('pdf-upload');
    const iosTabs = document.getElementById('ios-tabs');
    const uploadTabContent = document.getElementById('Upload');

    // --- APP STATE ---
    let meals = [];

    // --- INITIALIZATION ---
    detectOS();
    pdfJsWorkerSrc();
    loadMealsFromSheet();

    function pdfJsWorkerSrc() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
    }

    // --- OS DETECTION & UI SETUP ---
    function detectOS() {
        authContainer.classList.add('hidden'); // Hide the old auth button
        mealListContainer.classList.remove('hidden');

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

    // --- DATA FETCHING ---
    async function loadMealsFromSheet() {
        setLoading(true);
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getMeals}`);
            meals = await response.json();
            renderMealList();
        } catch (err) {
            console.error("Error loading meals:", err);
            alert("Could not load meals from the backend.");
        } finally {
            setLoading(false);
        }
    }

    // --- PDF HANDLING ---
    pdfUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') return;

        setLoading(true);
        try {
            // 1. Identify meals to delete
            const mealsToDelete = meals.filter(m => m.eaten).map(m => m.row);
            
            // 2. Parse the new PDF
            const newMealsText = await parsePdf(file);
            const newMeals = newMealsText
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 2);

            // 3. Send data to Google Apps Script to handle the update
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Required header for GAS POST
                body: JSON.stringify({
                    action: 'uploadNewList',
                    payload: { mealsToDelete, newMeals }
                })
            });

            const result = await response.json();
            if(result.status !== 'success') throw new Error(result.message);
            
            alert(`${newMeals.length} new meals have been uploaded!`);
            await loadMealsFromSheet(); // Reload the list

        } catch (error) {
            console.error("Error during PDF upload process:", error);
            alert("An error occurred while uploading the new meal list.");
            setLoading(false); // Ensure loading is turned off on error
        } finally {
            pdfUploadInput.value = ''; // Reset input
        }
    });

    async function parsePdf(file) {
        // This function remains the same as before
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async (event) => {
                try {
                    const pdf = await pdfjsLib.getDocument({ data: event.target.result }).promise;
                    let textContent = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const text = await page.getTextContent();
                        textContent += text.items.map(s => s.str).join(' ') + '\n';
                    }
                    resolve(textContent);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // --- UI & MEAL LOGIC ---
    function renderMealList() {
        // This function remains the same as before
        mealListEl.innerHTML = '';
        if (meals.length === 0) {
            mealListEl.innerHTML = '<p>No meals found. Upload a PDF to get started!</p>';
        } else {
            meals.forEach(meal => {
                const li = document.createElement('li');
                li.className = 'meal-item';
                li.innerHTML = `
                    <input type="checkbox" id="meal-${meal.row}" ${meal.eaten ? 'checked' : ''}>
                    <label for="meal-${meal.row}">${meal.name}</label>
                `;
                li.querySelector('input').addEventListener('change', (e) => {
                    toggleMealEaten(meal.row, e.target.checked);
                });
                mealListEl.appendChild(li);
            });
        }
        updateMealCounter();
    }

    function updateMealCounter() {
        // This function remains the same as before
        const remaining = meals.filter(m => !m.eaten).length;
        mealCounterEl.textContent = remaining;
        if (remaining <= 5) {
            mealCounterEl.classList.add('alert');
        } else {
            mealCounterEl.classList.remove('alert');
        }
    }

    async function toggleMealEaten(rowIndex, isEaten) {
        const meal = meals.find(m => m.row === rowIndex);
        if (meal) meal.eaten = isEaten;
        updateMealCounter();

        // Update the Google Sheet via our secure script
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'updateMealStatus',
                    payload: { row: rowIndex, eaten: isEaten }
                })
            });
        } catch (err) {
            console.error("Error updating sheet:", err);
            alert("Could not update meal status.");
            // Revert optimistic UI update if you want
            if(meal) meal.eaten = !isEaten;
            renderMealList();
        }
    }

    function setLoading(isLoading) {
        // This function remains the same as before
        if (isLoading) {
            loadingSpinner.classList.remove('hidden');
            mealListContainer.classList.add('hidden');
        } else {
            loadingSpinner.classList.add('hidden');
            mealListContainer.classList.remove('hidden');
        }
    }

    // --- Tab Switching Logic for iOS ---
    window.openTab = (evt, tabName) => {
        // This function remains the same as before
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
