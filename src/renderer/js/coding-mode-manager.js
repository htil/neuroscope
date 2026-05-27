/**
 * Coding Mode Manager
 * Manages the interaction between block coding and text coding modes
 */

import { textEditor } from './text-editor.js';
import { javascriptGenerator } from 'blockly/javascript';

export class CodingModeManager {
    constructor() {
        this.currentMode = 'blocks'; // 'blocks' or 'text'
        this.blocklyWorkspace = null;
        this.textEditorInstance = null;
        this.lastGeneratedText = '';
        this.isInitialized = false;
    }

    /**
     * Initialize the coding mode manager
     * @param {Blockly.Workspace} workspace - The Blockly workspace
     */
    async initialize(workspace) {
        this.blocklyWorkspace = workspace;

        // Initialize text editor
        const textEditorContainer = document.getElementById('textEditorDiv');
        this.textEditorInstance = await textEditor.initialize(
            textEditorContainer,
            '# Welcome to text coding mode!\n# Click "Convert" to generate code from your blocks\n',
            (text) => this.onTextChanged(text)
        );

        // Set up event listeners
        this.setupEventListeners();

        // Set initial mode
        this.setMode('blocks');

        this.isInitialized = true;
        console.log('Coding Mode Manager initialized');
    }

    /**
     * Set up event listeners for mode switching and sync
     */
    setupEventListeners() {
        // Block mode button
        const blockModeBtn = document.getElementById('block-mode-btn');
        if (blockModeBtn) {
            blockModeBtn.addEventListener('click', () => {
                console.log('Block mode button clicked');
                this.setMode('blocks');
            });
        } else {
            console.warn('Block mode button not found');
        }

        // Text mode button
        const textModeBtn = document.getElementById('text-mode-btn');
        if (textModeBtn) {
            textModeBtn.addEventListener('click', () => {
                console.log('Text mode button clicked');
                this.setMode('text');
            });
        } else {
            console.warn('Text mode button not found');
        }

        // Sync button (convert blocks to text)
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                console.log('Convert button clicked');
                this.convertBlocksToText();
            });
        } else {
            console.warn('Sync button not found');
        }

        // Listen for Blockly workspace changes
        if (this.blocklyWorkspace) {
            this.blocklyWorkspace.addChangeListener(() => {
                this.onBlocksChanged();
            });
        }
    }    /**
     * Switch between coding modes
     * @param {string} mode - 'blocks' or 'text'
     */
    setMode(mode) {
        if (mode === this.currentMode) return;

        this.currentMode = mode;

        const blocklyDiv = document.getElementById('blocklyDiv');
        const textEditorDiv = document.getElementById('textEditorDiv');
        const blockModeBtn = document.getElementById('block-mode-btn');
        const textModeBtn = document.getElementById('text-mode-btn');
        const syncBtn = document.getElementById('sync-btn');

        if (mode === 'blocks') {
            // Show blocks, hide text editor
            blocklyDiv.style.display = 'block';
            textEditorDiv.style.display = 'none';

            // Update button states
            blockModeBtn.classList.add('active', 'blue');
            textModeBtn.classList.remove('active', 'blue');

            // Update sync button
            syncBtn.innerHTML = '<i class="sync icon"></i> Convert';
            syncBtn.title = 'Convert blocks to text';

            // Resize Blockly
            if (this.blocklyWorkspace) {
                Blockly.svgResize(this.blocklyWorkspace);
            }

        } else if (mode === 'text') {
            // Show text editor, hide blocks
            blocklyDiv.style.display = 'none';
            textEditorDiv.style.display = 'block';

            // Update button states
            textModeBtn.classList.add('active', 'blue');
            blockModeBtn.classList.remove('active', 'blue');

            // Update sync button
            syncBtn.innerHTML = '<i class="sync icon"></i> Update';
            syncBtn.title = 'Update blocks from text (limited)';

            // Resize text editor
            if (this.textEditorInstance) {
                setTimeout(() => {
                    this.textEditorInstance.resize();
                }, 100);
            }
        }

        console.log(`Switched to ${mode} mode`);
    }

    /**
     * Convert blocks to text code using Blockly's built-in JavaScript generator
     */
    convertBlocksToText() {
        if (!this.blocklyWorkspace) {
            console.error('Blockly workspace not available');
            return;
        }

        try {
            // Use Blockly's built-in JavaScript code generator
            const generatedCode = javascriptGenerator.workspaceToCode(this.blocklyWorkspace);

            // Convert to more readable Python-like format
            const readableCode = this.convertJavaScriptToPythonLike(generatedCode);

            // Update text editor
            if (this.textEditorInstance) {
                this.textEditorInstance.setValue(readableCode);
                this.lastGeneratedText = readableCode;
            }

            // Show success message
            this.showMessage('Blocks converted to text successfully!', 'success');

            // Switch to text mode to show the result
            if (this.currentMode === 'blocks') {
                this.setMode('text');
            }

        } catch (error) {
            console.error('Error converting blocks to text:', error);
            this.showMessage('Error converting blocks to text: ' + error.message, 'error');
        }
    }

    /**
     * Convert JavaScript code to more readable Python-like format
     */
    convertJavaScriptToPythonLike(jsCode) {
        if (!jsCode.trim()) {
            return '# No blocks to convert\n# Add some blocks in the visual editor and click Convert!';
        }

        let pythonLike = '# Generated from Blockly visual programming\n';
        pythonLike += '# This represents your visual blocks as executable code\n\n';

        // Simple transformations to make JavaScript more Python-like
        let converted = jsCode
            // Remove var declarations and make them more Python-like
            .replace(/var\s+(\w+)\s*=\s*/g, '$1 = ')
            // Convert console.log to print
            .replace(/console\.log\(/g, 'print(')
            // Convert function calls to be more readable
            .replace(/window\.electronAPI\.sendCommand\(/g, 'send_command(')
            // Clean up whitespace
            .replace(/;\s*\n/g, '\n')
            .replace(/;$/gm, '')
            // Make control structures more readable
            .replace(/if\s*\(/g, 'if (')
            .replace(/for\s*\(/g, 'for (')
            .replace(/while\s*\(/g, 'while (');

        pythonLike += converted;

        return pythonLike;
    }    /**
     * Called when the text editor content changes
     * @param {string} text - New text content
     */
    onTextChanged(text) {
        // For now, we don't automatically sync text back to blocks
        // This could be implemented as a future enhancement
        if (text !== this.lastGeneratedText) {
            // Text has been manually modified
            const syncBtn = document.getElementById('sync-btn');
            if (this.currentMode === 'text') {
                syncBtn.innerHTML = '<i class="warning sign icon"></i> Modified';
                syncBtn.title = 'Text modified - automatic sync to blocks not supported';
                syncBtn.classList.add('orange');
            }
        }
    }

    /**
     * Called when blocks change
     */
    onBlocksChanged() {
        // Reset sync button state when blocks change
        const syncBtn = document.getElementById('sync-btn');
        if (this.currentMode === 'blocks') {
            syncBtn.innerHTML = '<i class="sync icon"></i> Convert';
            syncBtn.title = 'Convert blocks to text';
            syncBtn.classList.remove('orange');
        }
    }

    /**
     * Get the current code (from active mode)
     * @returns {string} Current code content
     */
    getCurrentCode() {
        if (this.currentMode === 'text' && this.textEditorInstance) {
            return this.textEditorInstance.getValue();
        } else if (this.currentMode === 'blocks' && this.blocklyWorkspace) {
            const jsCode = javascriptGenerator.workspaceToCode(this.blocklyWorkspace);
            return this.convertJavaScriptToPythonLike(jsCode);
        }
        return '';
    }    /**
     * Execute the current code (works with both modes)
     */
    executeCurrentCode() {
        let codeToExecute;

        if (this.currentMode === 'text' && this.textEditorInstance) {
            // Execute text directly (would need a text-to-execution engine)
            codeToExecute = this.textEditorInstance.getValue();
            this.showMessage('Text code execution not yet implemented. Switch to blocks mode to run.', 'warning');
            return;
        } else if (this.currentMode === 'blocks' && this.blocklyWorkspace) {
            // Use existing Blockly execution
            // This should integrate with the existing interpreter system
            codeToExecute = window.interpreter ? 'blocks' : null;
        }

        if (codeToExecute === 'blocks') {
            // Trigger the existing block execution system
            const runButton = document.getElementById('run');
            if (runButton) {
                runButton.click();
            }
        } else {
            this.showMessage('No executable code available', 'warning');
        }
    }

    /**
     * Show a temporary message to the user
     * @param {string} message - Message to show
     * @param {string} type - Message type ('success', 'warning', 'error')
     */
    showMessage(message, type = 'info') {
        // Create a temporary message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `ui ${type} message`;
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '10px';
        messageDiv.style.right = '10px';
        messageDiv.style.zIndex = '1000';
        messageDiv.style.maxWidth = '300px';
        messageDiv.innerHTML = `
      <i class="close icon"></i>
      <div class="header">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
      <p>${message}</p>
    `;

        document.body.appendChild(messageDiv);

        // Add close functionality
        const closeIcon = messageDiv.querySelector('.close.icon');
        closeIcon.addEventListener('click', () => {
            messageDiv.remove();
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    /**
     * Export current code as a file
     * @param {string} format - Export format ('py' for Python, 'txt' for text)
     */
    exportCode(format = 'py') {
        const code = this.getCurrentCode();
        if (!code.trim()) {
            this.showMessage('No code to export', 'warning');
            return;
        }

        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neuroscope_code.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage(`Code exported as ${a.download}`, 'success');
    }

    /**
     * Import code from text
     * @param {string} code - Code to import
     */
    importCode(code) {
        if (this.textEditorInstance) {
            this.textEditorInstance.setValue(code);
            this.setMode('text');
            this.showMessage('Code imported successfully', 'success');
        }
    }

    /**
     * Get current mode
     * @returns {string} Current mode ('blocks' or 'text')
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Dispose of resources
     */
    dispose() {
        if (this.textEditorInstance) {
            this.textEditorInstance.dispose();
        }
        this.isInitialized = false;
    }
}

// Export singleton instance
export const codingModeManager = new CodingModeManager();