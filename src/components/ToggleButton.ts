function create(options: {
    onText: string;
    offText: string;
    action: () => void;
}) {
    let toggleState = false;

    const button = document.createElement("button");
    button.textContent = options.offText;
    button.addEventListener("click", () => {
        toggleState = !toggleState;
        button.textContent = toggleState ? options.onText : options.offText;
        options.action();
    });

    return button;
}

const ToggleButton = {
    create,
};

export default ToggleButton;
