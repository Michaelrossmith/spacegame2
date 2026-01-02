window.addKeyboardListener = (dotNetRef) => {
    document.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
            e.preventDefault();
            dotNetRef.invokeMethodAsync('HandleKeyPress', e.key);
        }
    });
};