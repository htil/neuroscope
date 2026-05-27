export const Console = class {
    constructor() {
        this.maxLines = 100; // Maximum number of lines to keep in console
        this.consoleData = [];
        this.initConsole();
    }

    initConsole() {
        const panelBody = document.getElementById("signal-panel-body");
        panelBody.innerHTML = `
      <div style="padding: 10px; height: 100%; display: flex; flex-direction: column;">
        <div 
          id="console-output" 
          style="
            flex-grow: 1; 
            background-color: #1e1e1e; 
            color: #ffffff; 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            padding: 10px; 
            overflow-y: auto; 
            border-radius: 4px;
            border: 1px solid #333;
            white-space: pre-wrap;
            word-wrap: break-word;
          "
        ></div>
        <div style="margin-top: 5px; display: flex;">
          <button 
            id="console-clear" 
            class="ui mini button" 
            style="margin-right: 5px;"
          >
            Clear
          </button>
          <span 
            id="console-status" 
            style="
              font-size: 11px; 
              color: #666; 
              line-height: 28px;
            "
          >
            Ready
          </span>
        </div>
      </div>
    `;

        // Add event listener for clear button
        document.getElementById("console-clear").addEventListener("click", () => {
            this.clear();
        });

        // Set up auto-scroll behavior
        this.consoleOutput = document.getElementById("console-output");
        this.consoleStatus = document.getElementById("console-status");

        this.print("Console ready", "info");
    }

    print(message, type = "log") {
        // Add to internal data array (no timestamp formatting)
        this.consoleData.push({
            message: message,
            type: type
        });

        // Keep only the last maxLines entries
        if (this.consoleData.length > this.maxLines) {
            this.consoleData = this.consoleData.slice(-this.maxLines);
        }

        // Update the display
        this.updateDisplay();

        // Update status
        this.updateStatus(type);
    }

    updateDisplay() {
        if (!this.consoleOutput) return;

        // Build the display text - just the messages, no prefixes or timestamps
        const displayText = this.consoleData.map(entry => entry.message).join("\n");

        this.consoleOutput.textContent = displayText;

        // Auto-scroll to bottom
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    updateStatus(lastMessageType) {
        if (!this.consoleStatus) return;

        const statusText = `${this.consoleData.length} lines`;
        let statusColor = "#666";

        switch (lastMessageType) {
            case "error":
                statusColor = "#ff4444";
                break;
            case "warning":
                statusColor = "#ffaa00";
                break;
            case "success":
                statusColor = "#44ff44";
                break;
            case "info":
                statusColor = "#4488ff";
                break;
        }

        this.consoleStatus.textContent = statusText;
        this.consoleStatus.style.color = statusColor;
    }

    clear() {
        this.consoleData = [];
        if (this.consoleOutput) {
            this.consoleOutput.textContent = "";
        }
        this.print("Console cleared", "info");
    }

    // Convenience methods for different message types
    log(message) {
        this.print(message, "log");
    }

    error(message) {
        this.print(message, "error");
    }

    warning(message) {
        this.print(message, "warning");
    }

    info(message) {
        this.print(message, "info");
    }

    success(message) {
        this.print(message, "success");
    }

    // Method to simulate print commands from Blockly code execution
    blocklyPrint(message) {
        this.print(message, "log");
    }
};
