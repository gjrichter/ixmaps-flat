/**
 * DialogManager.js
 * A class to create and manage multiple HTML dialogs
 * Based on the existing myDialog implementation
 */

class DialogManager {
    constructor() {
        this.dialogs = new Map(); // Store all created dialogs
        this.dialogCounter = 0; // Counter for generating unique IDs
        this.defaultOptions = {
            width: '400px',
            height: '300px',
            position: { top: '100px', left: '100px' },
            draggable: true,
            resizable: true,
            modal: false,
            zIndex: 1000
        };
    }

    /**
     * Create a new dialog
     * @param {Object} options - Dialog configuration options
     * @returns {Object} Dialog instance
     */
    createDialog(options = {}) {
        const dialogId = `dialog-${++this.dialogCounter}`;
        const config = { ...this.defaultOptions, ...options };
        
        // Create dialog element
        const dialog = document.createElement('dialog');
        dialog.id = dialogId;
        dialog.setAttribute('aria-label', config.title || 'Dialog');
        dialog.style.cssText = `
            position: fixed;
            top: ${config.position.top || 'auto'};
            left: ${config.position.left || 'auto'};
            bottom: ${config.position.bottom || 'auto'};
            z-index: ${config.zIndex};
            margin: 0;
            padding: 0;
            border: none;
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            background: white;
        `;

        // Create header
        const header = document.createElement('div');
        header.className = 'dialog-header';
        header.id = `${dialogId}-header`;
        header.style.cssText = `
            display: flex;
            XXalign-items: center;
            justify-content: space-between;
            background: none;
            color: #888888;
            padding: 10px 30px 1px 15px;
            cursor: move;
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
            user-select: none;
            font-family: Arial, Helvetica, sans-serif;
            font-weight: normal;
            letter-spacing: 0.02em;
        `;
        header.textContent = config.title || 'Dialog';

        // Create body
        const body = document.createElement('div');
        body.className = 'dialog-body';
        body.id = `${dialogId}-body`;
        body.style.cssText = `
            padding: 1em;
            background: white;
            color: #222;
            width: ${config.width};
            height: ${config.height};
            overflow: auto;
            text-align: left;
        `;

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close dialog');
        closeBtn.style.cssText = `
            position: absolute;
            top: 0.5em;
            right: 0.5em;
            background: transparent;
            border: solid white 1px;
            color: black;
            font-size: 1.3em;
            cursor: pointer;
            padding: 3px 8px;
            border-radius: 3px;
            transition: background 0.2s;
            z-index: 1001;
        `;

        // Add event listeners
        closeBtn.addEventListener('click', () => this.closeDialog(dialogId));
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = '#ffffff';
            closeBtn.style.border = 'solid black 1px';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'transparent';
            closeBtn.style.border = 'solid white 1px';
        });

        // Assemble dialog
        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(closeBtn);

        // Add to document
        if (config.target) {
            $("#"+config.target)[0].appendChild(dialog);
        } else {
            document.body.appendChild(dialog);
        }    

        // Setup dragging if enabled
        if (config.draggable) {
            this.setupDragging(dialog, header);
        }

        // Setup resizing if enabled
        if (config.resizable) {
            this.setupResizing(dialog, dialogId);
        }

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts(dialog, dialogId);

        // Store dialog instance
        const dialogInstance = {
            id: dialogId,
            element: dialog,
            header: header,
            body: body,
            closeBtn: closeBtn,
            config: config,
            isOpen: false,
            onResize: null, // Callback for resize events
            
            // Methods
            show: () => this.showDialog(dialogId),
            hide: () => this.hideDialog(dialogId),
            close: () => this.closeDialog(dialogId),
            setTitle: (title) => this.setDialogTitle(dialogId, title),
            setContent: (content) => this.setDialogContent(dialogId, content),
            loadContent: (url, options) => this.loadDialogContent(dialogId, url, options),
            resize: (width, height) => this.resizeDialog(dialogId, width, height),
            move: (top, left) => this.moveDialog(dialogId, top, left),
            setOnResize: (callback) => this.setOnResizeCallback(dialogId, callback)
        };

        this.dialogs.set(dialogId, dialogInstance);
        return dialogInstance;
    }

    /**
     * Show a dialog
     * @param {string} dialogId - ID of the dialog to show
     */
    showDialog(dialogId) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance && !dialogInstance.isOpen) {
            dialogInstance.element.show();
            dialogInstance.isOpen = true;
        }
    }

    /**
     * Hide a dialog
     * @param {string} dialogId - ID of the dialog to hide
     */
    hideDialog(dialogId) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance && dialogInstance.isOpen) {
            dialogInstance.element.close();
            dialogInstance.isOpen = false;
        }
    }

    /**
     * Close and remove a dialog
     * @param {string} dialogId - ID of the dialog to close
     */
    closeDialog(dialogId) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance) {
            dialogInstance.body.innerHTML = "";
            // Clean up ResizeObserver if it exists
            if (dialogInstance.resizeObserver) {
                dialogInstance.resizeObserver.disconnect();
            }
            dialogInstance.element.close();
            dialogInstance.element.remove();
            this.dialogs.delete(dialogId);
        }
    }

    /**
     * Set dialog title
     * @param {string} dialogId - ID of the dialog
     * @param {string} title - New title
     */
    setDialogTitle(dialogId, title) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance) {
            dialogInstance.header.textContent = title;
        }
    }

    /**
     * Set dialog content
     * @param {string} dialogId - ID of the dialog
     * @param {string} content - HTML content
     */
    setDialogContent(dialogId, content) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance) {
            dialogInstance.body.innerHTML = content;
        }
    }

    /**
     * Load content from URL with enhanced functionality
     * @param {string} dialogId - ID of the dialog
     * @param {string} url - URL to load content from
     * @param {Object} options - Loading options
     */
    loadDialogContent(dialogId, url, options = {}) {

        return this.loadContentWithJQuery(dialogId, url, options);
        /**
        const dialogInstance = this.dialogs.get(dialogId);
        if (!dialogInstance) return;

        const {
            method = 'GET',
            headers = {},
            body = null,
            showLoading = true,
            loadingText = 'Loading...',
            errorHandler = null,
            successHandler = null,
            timeout = 30000
        } = options;

        // Show loading state if enabled
        if (showLoading) {
            dialogInstance.body.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                    </div>
                    <div>${loadingText}</div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
        }

        // Create fetch options
        const fetchOptions = {
            method: method,
            headers: {
                'Content-Type': 'text/html',
                ...headers
            }
        };

        if (body && method !== 'GET') {
            fetchOptions.body = body;
        }

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), timeout);
        });

        // Fetch content with timeout
        Promise.race([
            fetch(url, fetchOptions),
            timeoutPromise
        ])
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            // Execute any scripts in the loaded HTML
            dialogInstance.body.innerHTML = html;
            
            // Execute scripts found in the loaded content
            this.executeScripts(dialogInstance.body);
            
            // Call success handler if provided
            if (successHandler && typeof successHandler === 'function') {
                successHandler(dialogInstance, html);
            }
        })
        .catch(error => {
            console.error('Error loading dialog content:', error);
            
            let errorMessage = `Error loading content: ${error.message}`;
            
            // Call custom error handler if provided
            if (errorHandler && typeof errorHandler === 'function') {
                const customError = errorHandler(dialogInstance, error);
                if (customError) {
                    errorMessage = customError;
                }
            }
            
            dialogInstance.body.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    <div style="margin-bottom: 20px; font-size: 48px;">⚠️</div>
                    <h3>Error Loading Content</h3>
                    <p>${errorMessage}</p>
                    <button onclick="this.parentElement.parentElement.parentElement.close()" 
                            style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
                        Close
                    </button>
                </div>
            `;
        });
        **/
    }

    /**
     * Execute scripts found in loaded HTML content
     * @param {HTMLElement} container - Container element with loaded content
     */
    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            
            // Copy script attributes
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy script content
            if (script.innerHTML) {
                newScript.innerHTML = script.innerHTML;
            }
            
            // Replace old script with new one
            script.parentNode.replaceChild(newScript, script);
        });
    }

    /**
     * Load content using jQuery (if available) - alternative to fetch
     * @param {string} dialogId - ID of the dialog
     * @param {string} url - URL to load content from
     * @param {Object} options - jQuery load options
     */
    loadContentWithJQuery(dialogId, url, options = {}) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (!dialogInstance || !window.jQuery) {
            console.error('jQuery not available or dialog not found');
            return;
        }

        const {
            data = null,
            complete = null,
            error = null
        } = options;

        // Show loading state
        dialogInstance.body.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="margin-bottom: 20px;">
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <div>Loading...</div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        // Use jQuery load method
        $(dialogInstance.body).load(url, data, function(response, status, xhr) {
            if (status === "error") {
                const errorMsg = `Error loading content: ${xhr.status} ${xhr.statusText}`;
                dialogInstance.body.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #dc3545;">
                        <div style="margin-bottom: 20px; font-size: 48px;">⚠️</div>
                        <h3>Error Loading Content</h3>
                        <p>${errorMsg}</p>
                        <button onclick="this.parentElement.parentElement.parentElement.close()" 
                                style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
                            Close
                        </button>
                    </div>
                `;
                
                if (error && typeof error === 'function') {
                    error(xhr, status, errorMsg);
                }
            } else {
                // Execute scripts in loaded content
                this.executeScripts(dialogInstance.body);
                
                if (complete && typeof complete === 'function') {
                    complete(response, status, xhr);
                }
            }
        }.bind(this));
    }

    /**
     * Resize dialog
     * @param {string} dialogId - ID of the dialog
     * @param {string} width - New width
     * @param {string} height - New height
     */
    resizeDialog(dialogId, width, height) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance) {
            if (width) dialogInstance.body.style.width = width;
            if (height) dialogInstance.body.style.height = height;
        }
    }

    /**
     * Move dialog to new position
     * @param {string} dialogId - ID of the dialog
     * @param {string} top - New top position
     * @param {string} left - New left position
     */
    moveDialog(dialogId, top, left) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance) {
            if (top) {
                dialogInstance.element.style.top = top;
                dialogInstance.element.style.bottom = 'auto';
            }
            if (left) dialogInstance.element.style.left = left;
        }
    }

    /**
     * Setup dragging functionality
     * @param {HTMLElement} dialog - Dialog element
     * @param {HTMLElement} header - Header element
     */
    setupDragging(dialog, header) {
        let isDragging = false;
        let startX, startY, dialogStartX, dialogStartY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-btn')) return;
            
            isDragging = true;
            const rect = dialog.getBoundingClientRect();
            dialog.style.bottom = 'auto';
            dialog.style.left = rect.left + "px";
            dialog.style.top = rect.top + "px";
            startX = e.clientX;
            startY = e.clientY;
            dialogStartX = rect.left;
            dialogStartY = rect.top;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            let dx = e.clientX - startX;
            let dy = e.clientY - startY;
            dialog.style.left = (dialogStartX + dx) + "px";
            dialog.style.top = (dialogStartY + dy) + "px";
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    }

    /**
     * Setup resizing functionality
     * @param {HTMLElement} dialog - Dialog element
     * @param {string} dialogId - Dialog ID
     */
    setupResizing(dialog, dialogId) {
        // Add resize handles to the dialog
        dialog.style.resize = 'both';
        dialog.style.overflow = 'hidden';
        dialog.style["max-width"] = '100%';

        
        // Add ResizeObserver to detect size changes
        if (typeof ResizeObserver !== 'undefined') {
            let isResizing = false; // Flag to prevent infinite loops
            
            const resizeObserver = new ResizeObserver((entries) => {
                // Prevent infinite loops
                if (isResizing) return;
                
                for (const entry of entries) {
                    const dialogInstance = this.dialogs.get(dialogId);
                    if (dialogInstance && dialogInstance.onResize) {
                        const rect = entry.contentRect;
                        
                        // Set flag to prevent recursive calls
                        isResizing = true;
                        
                        try {
                            // Only update if dimensions actually changed
                            const body = dialog.querySelector('.dialog-body');
                            if (body) {
                                const currentWidth = parseInt(body.style.width) || body.offsetWidth;
                                const currentHeight = parseInt(body.style.height) || body.offsetHeight;
                                
                                // Only update if there's a significant change (avoid micro-adjustments)
                                const widthDiff = Math.abs(rect.width - currentWidth);
                                const heightDiff = Math.abs(rect.height - currentHeight);
                                
                                if (widthDiff > 1 || heightDiff > 1) {
                                    body.style.width = rect.width + "px";
                                    body.style.height = rect.height + "px";
                                    
                                    // Call the resize callback
                                    dialogInstance.onResize({
                                        width: rect.width,
                                        height: rect.height,
                                        element: dialog,
                                        dialogId: dialogId
                                    });
                                }
                            }
                        } catch (error) {
                            console.error('Error during resize:', error);
                        } finally {
                            // Reset flag after a short delay to allow for natural resizing
                            setTimeout(() => {
                                isResizing = false;
                            }, 50);
                        }
                    }
                }
            });
            
            resizeObserver.observe(dialog);
            console.log("Dialog resizable!");
            
            // Store observer reference for cleanup
            const dialogInstance = this.dialogs.get(dialogId);
            if (dialogInstance) {
                dialogInstance.resizeObserver = resizeObserver;
            }
        }
    }

    /**
     * Set resize callback for a dialog
     * @param {string} dialogId - Dialog ID
     * @param {Function} callback - Callback function to call on resize
     */
    setOnResizeCallback(dialogId, callback) {
        const dialogInstance = this.dialogs.get(dialogId);
        if (dialogInstance) {
            dialogInstance.onResize = callback;
        }
    }

    /**
     * Setup keyboard shortcuts
     * @param {HTMLElement} dialog - Dialog element
     * @param {string} dialogId - Dialog ID
     */
    setupKeyboardShortcuts(dialog, dialogId) {
        dialog.addEventListener('keydown', (event) => {
            if (event.key === "Escape") {
                this.closeDialog(dialogId);
            }
        });
    }

    /**
     * Get all open dialogs
     * @returns {Array} Array of open dialog instances
     */
    getOpenDialogs() {
        return Array.from(this.dialogs.values()).filter(dialog => dialog.isOpen);
    }

    /**
     * Get count of open dialogs
     * @returns {number} Number of currently open dialogs
     */
    getOpenDialogsCount() {
        return this.getOpenDialogs().length;
    }

    /**
     * Check if maximum dialog limit is reached
     * @param {number} maxDialogs - Maximum allowed dialogs (default: 10)
     * @returns {boolean} True if limit reached
     */
    isMaxDialogsReached(maxDialogs = 10) {
        return this.getOpenDialogsCount() >= maxDialogs;
    }

    /**
     * Close all dialogs
     */
    closeAllDialogs() {
        this.dialogs.forEach(dialog => {
            if (dialog.isOpen) {
                dialog.hide();
            }
        });
    }

    /**
     * Get dialog statistics
     * @returns {Object} Dialog statistics
     */
    getStats() {
        const total = this.dialogs.size;
        const open = this.getOpenDialogsCount();
        const closed = total - open;
        
        return {
            total,
            open,
            closed,
            maxReached: this.isMaxDialogsReached()
        };
    }

    /**
     * Get dialog by ID
     * @param {string} dialogId - Dialog ID
     * @returns {Object|null} Dialog instance or null
     */
    getDialog(dialogId) {
        return this.dialogs.get(dialogId) || null;
    }

    /**
     * Close all dialogs
     */
    closeAllDialogs() {
        for (const [dialogId] of this.dialogs) {
            this.closeDialog(dialogId);
        }
    }

    /**
     * Get dialog count
     * @returns {number} Number of dialogs
     */
    getDialogCount() {
        return this.dialogs.size;
    }
}

// Create global instance
window.dialogManager = new DialogManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DialogManager;
}
