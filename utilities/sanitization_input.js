// sanitizing the inputs to prevent from XSS 
const sanitizeInput = (input) => {
    // Use DOMParser to convert input to text
    const doc = new DOMParser().parseFromString(input, 'text/html');
    return doc.body.textContent || "";
};
export default sanitizeInput;
