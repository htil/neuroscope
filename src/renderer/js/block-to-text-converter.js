/**
 * Block to Text Converter
 * Converts Blockly workspace to readable Python-like text code
 */

export class BlockToTextConverter {
    constructor() {
        this.indentLevel = 0;
        this.output = [];
    }

    /**
     * Convert the entire Blockly workspace to text
     * @param {Blockly.Workspace} workspace 
     * @returns {string} Generated text code
     */
    convertWorkspace(workspace) {
        this.output = [];
        this.indentLevel = 0;

        // Add header comment
        this.addLine("# Generated from Blockly visual programming");
        this.addLine("# This code represents your visual blocks as text");
        this.addLine("");

        // Process all top-level blocks
        const topBlocks = workspace.getTopBlocks(true);

        topBlocks.forEach((block, index) => {
            if (index > 0) this.addLine(""); // Add spacing between top-level blocks
            this.convertBlock(block);
        });

        return this.output.join('\n');
    }

    /**
     * Convert a single block to text
     * @param {Blockly.Block} block 
     */
    convertBlock(block) {
        if (!block || block.disabled) return;

        const blockType = block.type;

        switch (blockType) {
            // Control structures
            case 'controls_repeat_ext':
                this.handleRepeatBlock(block);
                break;
            case 'controls_if':
                this.handleIfBlock(block);
                break;
            case 'controls_whileUntil':
                this.handleWhileBlock(block);
                break;

            // Signal processing blocks
            case 'filter_signal':
                return this.handleFilterSignal(block);
            case 'delta':
                return this.handleBandPower(block, 'delta');
            case 'theta':
                return this.handleBandPower(block, 'theta');
            case 'alpha':
                return this.handleBandPower(block, 'alpha');
            case 'beta':
                return this.handleBandPower(block, 'beta');
            case 'gamma':
                return this.handleBandPower(block, 'gamma');
            case 'muscle_energy':
                return this.handleMuscleEnergy(block);

            // Output blocks
            case 'print':
                this.handlePrint(block);
                break;

            // Robot control blocks
            case 'takeoff':
                this.addLine("robot.takeoff()");
                break;
            case 'land':
                this.addLine("robot.land()");
                break;
            case 'drone_up':
                this.handleMovement(block, 'move_up');
                break;
            case 'drone_down':
                this.handleMovement(block, 'move_down');
                break;
            case 'drone_forward':
                this.handleMovement(block, 'move_forward');
                break;
            case 'drone_back':
                this.handleMovement(block, 'move_back');
                break;
            case 'vex_turn_left':
                this.handleVexMovement(block, 'turn_left');
                break;
            case 'vex_turn_right':
                this.handleVexMovement(block, 'turn_right');
                break;
            case 'mechdog_turn_left':
                this.handleVexMovement(block, 'turn_left');
                break;
            case 'mechdog_turn_right':
                this.handleVexMovement(block, 'turn_right');
                break;
            case 'move':
                this.handleVexMove(block);
                break;
            case 'ccw':
                this.handleRotation(block, 'counter_clockwise');
                break;
            case 'cw':
                this.handleRotation(block, 'clockwise');
                break;
            case 'led_control':
                this.handleLedControl(block);
                break;

            // Timing blocks
            case 'wait_seconds':
                this.handleWait(block);
                break;

            // Math and logic blocks
            case 'math_number':
                return block.getFieldValue('NUM');
            case 'text':
                return `"${block.getFieldValue('TEXT')}"`;
            case 'logic_boolean':
                return block.getFieldValue('BOOL');
            case 'logic_compare':
                return this.handleComparison(block);
            case 'math_arithmetic':
                return this.handleArithmetic(block);

            default:
                this.addLine(`# Unknown block type: ${blockType}`);
                break;
        }

        // Process the next block in the sequence
        const nextBlock = block.getNextBlock();
        if (nextBlock) {
            this.convertBlock(nextBlock);
        }
    }

    // Block type handlers
    handleRepeatBlock(block) {
        const times = this.getFieldOrInputValue(block, 'TIMES', '10');
        this.addLine(`for i in range(${times}):`);
        this.indent();

        const doBlock = block.getInputTargetBlock('DO');
        if (doBlock) {
            this.convertBlock(doBlock);
        } else {
            this.addLine("pass  # No actions specified");
        }

        this.dedent();
    }

    handleIfBlock(block) {
        // Handle main IF condition
        const condition = this.getFieldOrInputValue(block, 'IF0', 'True');
        this.addLine(`if ${condition}:`);
        this.indent();

        const doBlock = block.getInputTargetBlock('DO0');
        if (doBlock) {
            this.convertBlock(doBlock);
        } else {
            this.addLine("pass  # No actions specified");
        }
        this.dedent();

        // Handle ELSEIF blocks (Blockly supports multiple elseif via IF1, IF2, etc.)
        let elseifIndex = 1;
        while (block.getInput(`IF${elseifIndex}`)) {
            const elseifCondition = this.getFieldOrInputValue(block, `IF${elseifIndex}`, 'True');
            this.addLine(`elif ${elseifCondition}:`);
            this.indent();

            const elseifDoBlock = block.getInputTargetBlock(`DO${elseifIndex}`);
            if (elseifDoBlock) {
                this.convertBlock(elseifDoBlock);
            } else {
                this.addLine("pass  # No actions specified");
            }
            this.dedent();

            elseifIndex++;
        }

        // Handle final ELSE clause
        const elseBlock = block.getInputTargetBlock('ELSE');
        if (elseBlock) {
            this.addLine("else:");
            this.indent();
            this.convertBlock(elseBlock);
            this.dedent();
        }
    }

    handleWhileBlock(block) {
        const mode = block.getFieldValue('MODE');
        const condition = this.getFieldOrInputValue(block, 'BOOL', 'True');

        if (mode === 'WHILE') {
            this.addLine(`while ${condition}:`);
        } else {
            this.addLine(`while not (${condition}):`);
        }

        this.indent();
        const doBlock = block.getInputTargetBlock('DO');
        if (doBlock) {
            this.convertBlock(doBlock);
        } else {
            this.addLine("pass  # No actions specified");
        }
        this.dedent();
    }

    handleFilterSignal(block) {
        const low = block.getFieldValue('low') || '0';
        const high = block.getFieldValue('high') || '30';
        const signal = this.getFieldOrInputValue(block, 'signal', 'signal');
        return `filter_signal(${signal}, ${low}, ${high})`;
    }

    handleBandPower(block, band) {
        const signal = this.getFieldOrInputValue(block, 'signal', 'signal');
        return `get_${band}_power(${signal})`;
    }

    handleMuscleEnergy(block) {
        const signal = this.getFieldOrInputValue(block, 'signal', 'signal');
        return `get_muscle_energy(${signal})`;
    }

    handlePrint(block) {
        const value = this.getFieldOrInputValue(block, 'VALUE', '"Hello World"');
        this.addLine(`print(${value})`);
    }

    handleMovement(block, direction) {
        const distance = this.getFieldOrInputValue(block, 'distance', '10');
        this.addLine(`robot.${direction}(${distance})`);
    }

    handleVexMovement(block, direction) {
        const distance = this.getFieldOrInputValue(block, 'distance', '4');
        this.addLine(`vex.${direction}(${distance})`);
    }

    handleVexMove(block) {
        const distance = this.getFieldOrInputValue(block, 'distance', '10');
        const direction = this.getFieldOrInputValue(block, 'direction', '0');
        this.addLine(`vex.move(distance=${distance}, direction=${direction})`);
    }

    handleRotation(block, direction) {
        const degrees = this.getFieldOrInputValue(block, 'degrees', '90');
        this.addLine(`robot.rotate_${direction}(${degrees})`);
    }

    handleLedControl(block) {
        const color = block.getFieldValue('COLOR') || 'red';
        const action = block.getFieldValue('ACTION') || 'on';
        this.addLine(`robot.led_${action}("${color}")`);
    }

    handleWait(block) {
        const seconds = this.getFieldOrInputValue(block, 'seconds', '1');
        this.addLine(`wait(${seconds})`);
    }

    handleComparison(block) {
        const op = block.getFieldValue('OP');
        const a = this.getFieldOrInputValue(block, 'A', '0');
        const b = this.getFieldOrInputValue(block, 'B', '0');

        const operators = {
            'EQ': '==',
            'NEQ': '!=',
            'LT': '<',
            'LTE': '<=',
            'GT': '>',
            'GTE': '>='
        };

        return `${a} ${operators[op] || '=='} ${b}`;
    }

    handleArithmetic(block) {
        const op = block.getFieldValue('OP');
        const a = this.getFieldOrInputValue(block, 'A', '0');
        const b = this.getFieldOrInputValue(block, 'B', '0');

        const operators = {
            'ADD': '+',
            'MINUS': '-',
            'MULTIPLY': '*',
            'DIVIDE': '/',
            'POWER': '**'
        };

        return `${a} ${operators[op] || '+'} ${b}`;
    }

    // Utility methods
    getFieldOrInputValue(block, name, defaultValue = '') {
        // Try to get field value first
        try {
            const fieldValue = block.getFieldValue(name);
            if (fieldValue !== null && fieldValue !== undefined) {
                return fieldValue;
            }
        } catch (e) {
            // Field doesn't exist, try input
        }

        // Try to get input value
        const inputBlock = block.getInputTargetBlock(name);
        if (inputBlock) {
            const result = this.convertBlock(inputBlock);
            return result || defaultValue;
        }

        return defaultValue;
    }

    addLine(text) {
        const indent = '    '.repeat(this.indentLevel);
        this.output.push(indent + text);
    }

    indent() {
        this.indentLevel++;
    }

    dedent() {
        this.indentLevel = Math.max(0, this.indentLevel - 1);
    }
}

// Export singleton instance
export const blockToTextConverter = new BlockToTextConverter();
