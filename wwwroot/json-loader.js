window.loadJsonData = async () => {
    try {
        const response = await fetch('space-objects.json');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading JSON:', error);
        return null;
    }
};

window.loadDialogueData = async () => {
    try {
        const response = await fetch('dialogue.json');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading dialogue:', error);
        return [];
    }
};