/**
 * Text Editor Component
 * Provides a Monaco Editor for text-based coding with syntax highlighting
 */

export class TextEditor {
    constructor() {
        this.editor = null;
        this.container = null;
        this.isInitialized = false;
        this.onChangeCallback = null;
    }

    /**
     * Initialize the text editor
     * @param {HTMLElement} container - Container element for the editor
     * @param {string} initialCode - Initial code content
     * @param {Function} onChange - Callback for when content changes
     */
    async initialize(container, initialCode = '', onChange = null) {
        this.container = container;
        this.onChangeCallback = onChange;

        // Load Monaco Editor from CDN if not already loaded
        if (!window.monaco) {
            await this.loadMonaco();
        }

        // Create the editor
        this.editor = monaco.editor.create(container, {
            value: initialCode,
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            cursorStyle: 'line',
            wordWrap: 'on',
            wrappingIndent: 'indent',
            contextmenu: true,
            selectOnLineNumbers: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            // Custom color scheme for the generated code
            tokenColorCustomizations: {
                comments: '#6A9955',
                keywords: '#569CD6',
                strings: '#CE9178',
                numbers: '#B5CEA8'
            }
        });

        // Set up change listener
        if (this.onChangeCallback) {
            this.editor.onDidChangeModelContent(() => {
                const value = this.editor.getValue();
                this.onChangeCallback(value);
            });
        }

        this.isInitialized = true;
        return this.editor;
    }

    /**
     * Load Monaco Editor from CDN
     */
    async loadMonaco() {
        return new Promise((resolve, reject) => {
            // Create script element for Monaco loader
            const loader = document.createElement('script');
            loader.src = 'https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js';
            loader.onload = () => {
                // Configure Monaco
                require.config({
                    paths: {
                        'vs': 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
                    }
                });

                // Load Monaco Editor
                require(['vs/editor/editor.main'], () => {
                    // Configure Python language features
                    monaco.languages.registerCompletionItemProvider('python', {
                        provideCompletionItems: (model, position) => {
                            return {
                                suggestions: this.getPythonCompletions()
                            };
                        }
                    });

                    resolve();
                });
            };
            loader.onerror = reject;
            document.head.appendChild(loader);
        });
    }

    /**
     * Get Python completion suggestions for our domain-specific functions
     */
    getPythonCompletions() {
        return [
            // Signal processing functions
            {
                label: 'filter_signal',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'filter_signal(${1:signal}, ${2:low_freq}, ${3:high_freq})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Filter signal between low and high frequencies'
            },
            {
                label: 'get_delta_power',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'get_delta_power(${1:signal})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Get delta band power (0.5-4 Hz)'
            },
            {
                label: 'get_theta_power',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'get_theta_power(${1:signal})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Get theta band power (4-8 Hz)'
            },
            {
                label: 'get_alpha_power',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'get_alpha_power(${1:signal})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Get alpha band power (8-12 Hz)'
            },
            {
                label: 'get_beta_power',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'get_beta_power(${1:signal})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Get beta band power (12-30 Hz)'
            },
            {
                label: 'get_gamma_power',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'get_gamma_power(${1:signal})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Get gamma band power (30-100 Hz)'
            },
            {
                label: 'get_muscle_energy',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'get_muscle_energy(${1:signal})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Get muscle energy from EMG signal'
            },
            // Robot control functions
            {
                label: 'robot.takeoff',
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: 'robot.takeoff()',
                documentation: 'Make robot take off'
            },
            {
                label: 'robot.land',
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: 'robot.land()',
                documentation: 'Make robot land'
            },
            {
                label: 'robot.move_up',
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: 'robot.move_up(${1:distance})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Move robot up by specified distance'
            },
            {
                label: 'robot.move_down',
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: 'robot.move_down(${1:distance})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Move robot down by specified distance'
            },
            {
                label: 'robot.move_forward',
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: 'robot.move_forward(${1:distance})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Move robot forward by specified distance'
            },
            {
                label: 'robot.move_back',
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: 'robot.move_back(${1:distance})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Move robot backward by specified distance'
            },
            // Utility functions
            {
                label: 'wait',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'wait(${1:seconds})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Wait for specified number of seconds'
            }
        ];
    }

    /**
     * Set the editor content
     * @param {string} code - Code to set
     */
    setValue(code) {
        if (this.editor) {
            this.editor.setValue(code);
        }
    }

    /**
     * Get the editor content
     * @returns {string} Current editor content
     */
    getValue() {
        return this.editor ? this.editor.getValue() : '';
    }

    /**
     * Focus the editor
     */
    focus() {
        if (this.editor) {
            this.editor.focus();
        }
    }

    /**
     * Resize the editor to fit its container
     */
    resize() {
        if (this.editor) {
            this.editor.layout();
        }
    }

    /**
     * Dispose of the editor
     */
    dispose() {
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
        this.isInitialized = false;
    }

    /**
     * Set the editor theme
     * @param {string} theme - Theme name ('vs', 'vs-dark', 'hc-black')
     */
    setTheme(theme) {
        if (this.editor) {
            monaco.editor.setTheme(theme);
        }
    }

    /**
     * Insert text at the current cursor position
     * @param {string} text - Text to insert
     */
    insertText(text) {
        if (this.editor) {
            const selection = this.editor.getSelection();
            const range = new monaco.Range(
                selection.startLineNumber,
                selection.startColumn,
                selection.endLineNumber,
                selection.endColumn
            );
            this.editor.executeEdits('', [{
                range: range,
                text: text
            }]);
        }
    }

    /**
     * Add error markers to the editor
     * @param {Array} errors - Array of error objects with line, column, message
     */
    setErrorMarkers(errors) {
        if (this.editor) {
            const markers = errors.map(error => ({
                startLineNumber: error.line,
                startColumn: error.column || 1,
                endLineNumber: error.line,
                endColumn: error.endColumn || 100,
                message: error.message,
                severity: monaco.MarkerSeverity.Error
            }));

            monaco.editor.setModelMarkers(this.editor.getModel(), 'syntax', markers);
        }
    }

    /**
     * Clear all error markers
     */
    clearErrorMarkers() {
        if (this.editor) {
            monaco.editor.setModelMarkers(this.editor.getModel(), 'syntax', []);
        }
    }
}

// Export singleton instance
export const textEditor = new TextEditor();
