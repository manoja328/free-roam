(function() {
    "use strict";
    var fr = window.fr;

    fr.editor = {

        keyCodes: {
            LEFT_BRACKET: 219,
            RIGHT_BRACKET: 221,
            LEFT_ARROW: 37,
            UP_ARROW: 38,
            RIGHT_ARROW: 39,
            DOWN_ARROW: 40,
            ARROWS: [37, 38, 39, 40],
            ENTER: 13,
            BACKSPACE: 8,
            DELETE: 46,
            TAB: 9
        },

        lastCharWasOpenBracket: false,

        renderedClass: "line",
        renderedSelector: ".line",
        readOnlyClass: "line-readOnly",
        editClass: "line-edit",
        editSelector: ".line-edit",
        linkClass: "link",
        linkSelector: ".link",

        init: function() {
            this.watchTextChanges();
            this.watchClicks();
            this.watchBlurs();
        },

        watchTextChanges: function() {
            var self = this;
            $(document).off("keydown").on("keydown", this.editSelector, function(e) {
                return self.handleKeyDown(e);
            });
        },

        handleKeyDown: function(e) {
            if (e.originalEvent.keyCode) {
                var key = e.originalEvent.keyCode;
                switch (key) {
                    case this.keyCodes.ENTER:
                        this.handleEnterKey(e.target);
                        return false;
                    case this.keyCodes.BACKSPACE:
                        return this.handleBackspace(e.target);
                    case this.keyCodes.DELETE:
                        return this.handleDelete(e.target);
                    case this.keyCodes.UP_ARROW:
                    case this.keyCodes.DOWN_ARROW:
                    case this.keyCodes.LEFT_ARROW:
                    case this.keyCodes.RIGHT_ARROW:
                        return this.handleArrowKeys(key, e);
                    case this.keyCodes.TAB:
                        return this.handleTab(e.target);
                    default:
                        break;
                }
            }
            return true;
        },

        handleEnterKey: function(node) {
            var currentCaretPos = node.selectionEnd;
            var textToKeep = $(node).val().substring(0, currentCaretPos);
            var textToYank = $(node).val().substring(currentCaretPos);
            $(node).val(textToKeep);
            var $editor = this.createNewEditor()
                .val(textToYank)
                .appendTo($(node).parent())
                .focus()
                .textareaAutoSize();
            $editor[0].setSelectionRange(0, 0);
        },

        handleTab: function(node) {
            var currentCaretPos = node.selectionEnd;
            $(node).val("\t" + $(node).val());
            node.setSelectionRange(currentCaretPos + 1, currentCaretPos + 1);
            return false;
        },

        handleBackspace: function(node) {
            var currentCaretPos = node.selectionEnd;
            if (0 === currentCaretPos) {
                var $prevNode = $(node).prev(self.renderedSelector);
                if ($prevNode.length) {
                    var textToAppend = $(node).val();
                    var newCaretPosition = $prevNode.text().trimEnd().length;
                    $prevNode.text($prevNode.text() + textToAppend);
                    this.switchToEditor($prevNode[0], newCaretPosition);
                    $(node).remove();
                    return false;
                }
            }
            return true;
        },

        handleDelete: function(node) {
            var currentCaretPos = node.selectionEnd;
            if ($(node).val().length === currentCaretPos) {
                var $nextNode = $(node).next(self.renderedSelector);
                if ($nextNode.length) {
                    var textToAppend = $nextNode.text();
                    $(node).val($(node).val() + textToAppend);
                    $nextNode.remove();
                    node.setSelectionRange(currentCaretPos, currentCaretPos);
                    return false;
                }
            }
            return true;
        },

        handleArrowKeys: function(key, e) {
            var self = this;
            var node = e.target;
            var currentEditorLines = fr.utils.getLines($(node));
            var currentCaretPos = node.selectionEnd;
            var currentLineInfo = fr.utils.getCurrentLineInfo(currentCaretPos, currentEditorLines);
            switch (key) {
                case self.keyCodes.UP_ARROW:
                    if (0 === currentLineInfo.lineIndex) {
                        // Move up to the previous node if there is one, maintain current caret position
                        var $prevNode = $(node).prev(self.renderedSelector);
                        if ($prevNode.length) {
                            var startingCaretLeftCoordinate = getCaretCoordinates(node, currentCaretPos).left;
                            var editorLines = fr.utils.getLines($prevNode);
                            var lineToFocus = editorLines[editorLines.length - 1];
                            var lengthUpToLastLine = editorLines.slice(0, editorLines.length - 1).join(" ").length + 1;
                            var caretPosition = Math.min(lengthUpToLastLine + currentCaretPos, lengthUpToLastLine + lineToFocus.length);
                            self.switchToEditor($prevNode[0], caretPosition, startingCaretLeftCoordinate);
                            return false;
                        }
                        return true;
                    }
                    break;
                case self.keyCodes.DOWN_ARROW:
                    if (currentEditorLines.length - 1 === currentLineInfo.lineIndex) {
                        // Move down if possible, maintain current caret position
                        var $nextNode = $(node).next(self.renderedSelector);
                        if ($nextNode.length) {
                            var startingCaretLeftCoordinate = getCaretCoordinates(node, currentCaretPos).left;
                            var editorLines = fr.utils.getLines($nextNode);
                            var lineToFocus = editorLines[0];
                            var caretPosition = Math.min(currentLineInfo.relativeCaretPos, lineToFocus.length);
                            self.switchToEditor($nextNode[0], caretPosition, startingCaretLeftCoordinate);
                            return false;
                        }
                        return true;
                    }
                    break;
                case self.keyCodes.RIGHT_ARROW:
                    if ($(node).val().trimEnd().length === currentCaretPos) {
                        // Move down if possible, move caret to beginning
                        var $nextNode = $(node).next(self.renderedSelector);
                        if ($nextNode.length) {
                            self.switchToEditor($nextNode[0], 0);
                        }
                    }
                    break;
                case self.keyCodes.LEFT_ARROW:
                    if (0 === currentCaretPos) {
                        // Move up if possible, move to caret to end
                        var $prevNode = $(node).prev(self.renderedSelector);
                        if ($prevNode.length) {
                            self.switchToEditor($prevNode[0], $prevNode.text().trimEnd().length);
                        }
                    }
                    break;
                default:
                    break;
            }
            return true;
        },

        watchClicks: function() {
            this.watchFocusClicks();
            this.watchLinkClicks();
        },

        createNewEditor: function() {
            var $editor = $("<textarea/>")
                .addClass(this.editClass)
                .css("min-height", 24);
            fr.autocomplete.listener.attach($editor[0]);
            return $editor;
        },

        switchToEditor: function(nodeToEdit, caretPosition, previousCaretLeftCoordinate) {
            var height = $(nodeToEdit).height();
            var width = $(nodeToEdit).width();
            var $textArea = this.createNewEditor()
                .width(width);

            var $temp = $("<div/>")
                .css({
                    "position": "absolute",
                    "left": "-9999px",
                })
                .appendTo(body)
                .append($textArea);

            var value = fr.parser.parseHtml(nodeToEdit.innerHTML.trimEnd());
            $textArea.val(value);

            setTimeout(function() {
                $textArea.textareaAutoSize();
                $textArea.height(height);

                caretPosition = undefined !== caretPosition ? caretPosition : $textArea.val().trimEnd().length;
                if (previousCaretLeftCoordinate) {
                    var newCaretLeftCoordinate = getCaretCoordinates($textArea[0], caretPosition).left;
                    var caretOffset = this.fineTuneCaretPosition(previousCaretLeftCoordinate, newCaretLeftCoordinate, caretPosition, $textArea[0]);
                    caretPosition += caretOffset;
                }
                $textArea[0].setSelectionRange(caretPosition, caretPosition);
                $textArea.replaceAll($(nodeToEdit));
                $textArea.focus();
                $temp.remove();
            }.bind(this), 0);
        },

        fineTuneCaretPosition: function(prevLeft, newLeft, currCaretPos, node) {
            var range = 5;
            var minDiff = Math.abs(prevLeft - newLeft);
            var currCaretOffset = 0;

            for (var offset = -range; offset <= range; offset++) {
                var left = getCaretCoordinates(node, currCaretPos + offset).left;
                var diff = Math.abs(prevLeft - left);
                if (diff < minDiff) {
                    minDiff = diff;
                    currCaretOffset = offset;
                }
            }
            return currCaretOffset;
        },

        switchToRendered: function(nodeToRender) {
            var plainText = $(nodeToRender).val();
            var renderedHtml = fr.parser.renderLine(plainText);
            $(nodeToRender).replaceWith(renderedHtml)
            fr.page.save();
        },

        watchFocusClicks: function() {
            var self = this;
            $(document).on("mousedown", this.renderedSelector, function(e) {
                var caretPos = fr.utils.translateCursorToCaret(e);
               self.switchToEditor(e.target, caretPos);
            });
        },

        watchLinkClicks: function() {
            $(document).on("click", this.linkSelector, function(e) { return false; });
            $(document).on("mousedown", this.linkSelector, function(e) {
                e.stopImmediatePropagation();
                var openInSideBar = e.originalEvent.shiftKey;
                var inSideBar = $(this).parents("#right-sidebar").length > 0;
                var pageTitle = $(this).text().replace("[[", '').replace("]]", '');
                if (!inSideBar && openInSideBar) {
                    fr.rightSidebar.openPage(pageTitle);
                } else {
                    fr.page.load(pageTitle);
                }
                e.preventDefault();
                return false;
            });
        },

        watchBlurs: function() {
            var self = this;
            $(document).on("blur", this.editSelector, function(e) {
                self.switchToRendered(e.target);
            });
        }
    };
})();