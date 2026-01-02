window.initSliceSlider = (sliderId, dotNetRef) => {
    const slider = document.getElementById(sliderId);
    if (slider) {
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            dotNetRef.invokeMethodAsync('UpdateSliceFromJS', value);
        });
    }
};