'use strict';

/* ---- GLOBALS and UNDO/REDO FUNCTIONALITY ---- */

/* used by calculateTDW, writeZero_toEmptyCell:
matches empty string, any number of spaces not preceded or followed by any other character than es, \s */
const emptyCellRegex =
	/![a-z]*[A-Z]*[0-9]*|![\[\]\{\}\!\@\#\$\%\^\&\*\(\)\<\>\<\>\/\?\'\"\~\`]|^\s+$|^$/gi;

/* e.target, e.target.innerText from focusinHandler, exit from focusoutHandler */
var last_action;
var initial_cellValue;
var exit_cellValue;
var original_inputString;

var undoStack = [];
var redoStack = [];

function saveState() {
	/* important! first click, last_action is undefined and saveState() throws a typeerror */
	if (last_action !== undefined) {
		let justUndo = last_action.matches(
			'#undo-toolbar-button, #undo-toolbar-icon, #undo-toolbar-text'
		);
		let justRedo = last_action.matches(
			'#redo-toolbar-button, #redo-toolbar-icon, #redo-toolbar-text'
		);
		if (!(justUndo || justRedo)) {
			redoStack = [];
		}
	}

	let table_wrapper = document.querySelector('.table-wrapper');
	let currentState = table_wrapper.querySelector('.table-container');
	undoStack.push(currentState.cloneNode(true));

	if (
		undoStack[undoStack.length - 1].isEqualNode(
			undoStack[undoStack.length - 2]
		) &&
		undoStack.length > 0
	) {
		undoStack.pop();
	}
}

function undoRedoFunctionality(e) {
	let table_wrapper = document.querySelector('.table-wrapper');
	let currentState = table_wrapper.querySelector('.table-container');
	let is_undoClick = isButtonType('undo-toolbar-button', e);
	let is_redoClick = isButtonType('redo-toolbar-button', e);

	undoStack = undoStack.filter(state => {
		return state !== undefined;
	});
	redoStack = redoStack.filter(state => {
		return state !== undefined;
	});

	if (undoStack.length == 0 && is_undoClick) {
		return;
	}
	if (is_undoClick) {
		if (undoStack.length >= 2) {
			redoStack.push(undoStack.pop());
			currentState.replaceWith(undoStack[undoStack.length - 1]);
			return;
		}
		currentState.replaceWith(undoStack.pop());
	}

	if (redoStack.length == 0 && is_redoClick) {
		return;
	}
	if (is_redoClick) {
		if (redoStack.length >= 2) {
			undoStack.push(redoStack[redoStack.length - 1]);
			currentState.replaceWith(redoStack.pop());
			return;
		}
		currentState.replaceWith(redoStack.pop());
	}
}

/* ---- UPDATERS and helper functions ---- */

/* returns integer subrIndex */
function get_subrIndex(subr_wrapper) {
	return subr_wrapper.id.charAt(subr_wrapper.id.length - 1);
}

/* returns Array from nodelist, from queryTarget.querySelectorAll(queryType),
main table if subrIndex == undefined, used by get_nodeList(), updaters, buildTable(),
queryType is a string, ex. 'tdw-val', 'ingredients-body', 'bp', 'sw', etc. */
function get_queryTarget(queryType, subrIndex = undefined) {
	let queryTarget =
		subrIndex == undefined
			? document
			: document.querySelector(`#subr-wrapper-${subrIndex}`);
	let selector =
		subrIndex == undefined ? `:not(.subr).${queryType}` : `.subr.${queryType}`;
	return Array.from(queryTarget.querySelectorAll(selector));
}

/* helper generates nodeList without header node for use by updaters,
tdw-val, tf-val input to get_queryTarget returns a nodeList with one element [tdw/tf-Node] */
function get_nodeList(queryType, subrIndex = undefined) {
	return get_queryTarget(queryType, subrIndex).filter(node => {
		return (
			node.id.match(/header/gi) == null && !node.classList.contains('template')
		);
	});
}

/* returns true if any node has warning class applied, used by updaters */
function isWarning() {
	return Array.from(document.querySelectorAll('.warning')).length > 0;
}

/* adds/removes 'warning' class and adjusts contentEditability */
function apply_warningChanges(userInputCell, flourSum = 100) {
	let CEnode_array = Array.from(document.querySelectorAll(CE_classNames));

	function adjust_contentEditability() {
		CEnode_array.forEach(node => {
			node.contentEditable = (() => {
				let is_tmwNode = node.matches('.tmw');
				let has_warningClass = node.matches('.warning');
				return has_warningClass && !is_tmwNode ? 'true' : 'false';
			})();
		});
	}

	let path_fromSubrButton = Array.from(
		document.querySelectorAll('.subr-parse-recipe-button:not(.template)')
	).some(btn => {
		return btn.isEqualNode(userInputCell);
	});
	if (userInputCell == undefined || path_fromSubrButton) {
		userInputCell = get_queryTarget('tdw-val')[0];
	}

	let isNum = !isNaN(Number(userInputCell.innerText));
	if (!isNum) {
		userInputCell.classList.add('warning');
		adjust_contentEditability();
		return;
	}
	if (flourSum == 100) {
		CEnode_array.forEach(node => {
			node.classList.remove('warning');
		});
		adjust_contentEditability();
		return;
	}
	let flourBP_nodeArray = CEnode_array.filter(node => {
		let is_flour_ingBP =
			node.matches('.ing-bp:not(.header):not(.template)') &&
			node.previousElementSibling.innerText.match(/flour/gi) !== null;
		let isChild_of_targetParent =
			is_flour_ingBP &&
			node.parentElement.parentElement.isEqualNode(
				userInputCell.parentElement.parentElement
			);
		return isChild_of_targetParent;
	});
	flourBP_nodeArray.forEach(node => {
		node.classList.add('warning');
	});
	adjust_contentEditability();
}

/* sums item weights, amounts and updatesTDW */
function calculateTDW() {
	let tdw_val = get_queryTarget('tdw-val')[0];
	let noItemRows = document.getElementById('items-body').childElementCount == 0;
	let is_validNum =
		!isNaN(Number(tdw_val.innerText)) &&
		tdw_val.innerText.match(emptyCellRegex) == null;
	if (noItemRows && is_validNum) {
		return roundTo(Number(tdw_val.innerText), 0);
	}

	function isEmpty_innerText(node) {
		return node.innerText.match(emptyCellRegex) !== null;
	}

	function drop_firstVal(arr) {
		arr.forEach(subarr => {
			subarr.shift();
		});
	}

	let itemWeightArray = Array.from(
		document.querySelectorAll('.items-weight:not(.header):not(.template)')
	);
	let itemAmountArray = itemWeightArray.map(node => node.nextElementSibling);
	let itemNameArray = itemWeightArray.map(node => node.previousElementSibling);
	let tdw = 0,
		itemName,
		converted_itemWeight,
		itemAmount;

	while (itemWeightArray.length > 0) {
		let emptyWeight_andOr_emptyAmount = (() => {
			return (
				isEmpty_innerText(itemWeightArray[0]) ||
				isEmpty_innerText(itemAmountArray[0])
			);
		})();

		if (emptyWeight_andOr_emptyAmount) {
			drop_firstVal([itemNameArray, itemWeightArray, itemAmountArray]);
			continue;
		}

		itemName =
			itemNameArray[0].innerText.match(emptyCellRegex) !== null
				? 'item_name'
				: itemNameArray[0].innerText;
		converted_itemWeight = unitConvert([
			parseUserInput(
				itemWeightArray[0].innerText + ' ' + itemName,
				undefined,
				true
			),
		]).flat()[0];
		if (isNaN(converted_itemWeight)) {
			apply_warningChanges(itemWeightArray[0]);
		}

		itemAmount = Number(itemAmountArray[0].innerText);
		if (isNaN(itemAmount)) {
			apply_warningChanges(itemAmountArray[0]);
		}

		tdw += converted_itemWeight * itemAmount;
		drop_firstVal([itemNameArray, itemWeightArray, itemAmountArray]);
	}
	return roundTo(tdw, 0);
}

/* updateTDW validates tdw direct changes and calls updateSW() */
function updateTDW(userInputCell) {
	let tdw_val = get_queryTarget('tdw-val')[0];
	if (userInputCell == undefined) {
		userInputCell = tdw_val;
	}

	apply_warningChanges(userInputCell);
	if (isWarning()) {
		return;
	}

	writeZero_toEmptyCell(tdw_val);
	calculateTDW();
	updateSW(userInputCell);
}

/* updateBP calls udpateSW() */
function updateBP(userInputCell, subrIndex = undefined) {
	let bp_nodeList = get_nodeList('ing-bp', subrIndex);
	let flour_nodeList = bp_nodeList.filter(node => {
		let is_flourNode =
			node.previousElementSibling.innerText.match(/flour/gi) !== null;
		let not_totalFlour = !node.matches('.tmw');
		return is_flourNode && not_totalFlour;
	});
	let flourSum = flour_nodeList
		.map(node => Number(node.innerText))
		.reduce((a, b) => a + b, 0);
	let ingBody_selector =
		subrIndex == undefined
			? '.ingredients-body'
			: `#subr-ingredients-body-${subrIndex}`;
	let tmwBP_index = subrIndex == undefined ? 2 : 1;
	let tmw_ingBP = Array.from(
		document.querySelector(ingBody_selector).firstElementChild.children
	)[tmwBP_index];

	/* set 'total flour' bp to flourSum */
	if (tmw_ingBP.classList.contains('tmw')) {
		tmw_ingBP.innerText = roundTo(flourSum, 3).replace(/\.$|\.0+$/gi, '');
	}

	/* important! if asterisk present, flourSum = 100 to avoid warning if flour ingredients present */
	if (tmw_ingBP.classList.contains('asterisk')) {
		flourSum = 100;
	}

	apply_warningChanges(userInputCell, flourSum);
	if (isWarning()) {
		return;
	}

	let tf_val = get_queryTarget('tf-val', subrIndex)[0];
	tf_val.innerText = roundTo(
		bp_nodeList
			.filter(node => {
				return !node.classList.contains('tmw');
			})
			.map(node => Number(node.innerText))
			.reduce((a, b) => a + b, 0),
		3
	);

	userInputCell.matches('.subr.ing-bp')
		? (() => {
				let sw_nodeList = document
					.getElementById(`subr-wrapper-${subrIndex}`)
					.querySelectorAll('.subr.ing-sw:not(.header):not(.template)');
				/* important! must precede get_ingNameAndBPArray() call */
				get_inputString('ing-bp', subrIndex);
				calculateSW(get_ingNameAndBPArray(subrIndex), sw_nodeList, subrIndex);
		  })()
		: updateSW(userInputCell, subrIndex);
}

/* helper: nodeType is 'ing-bp' or 'ing-sw', gets recipe string and populates #main-recipe-textarea */
function get_inputString(nodeType, subrIndex = undefined) {
	let temp = [];
	let nodeType_nodeList = get_nodeList(nodeType, subrIndex).filter(node => {
		return !node.classList.contains('tmw');
	});
	let name_nodeList = get_nodeList('ing-name', subrIndex).filter(node => {
		return !node.classList.contains('tmw');
	});
	while (nodeType_nodeList.length > 0) {
		temp.push([nodeType_nodeList[0].innerText, name_nodeList[0].innerText]);
		nodeType_nodeList.shift();
		name_nodeList.shift();
	}
	let textarea =
		subrIndex == undefined
			? document.getElementById('main-recipe-textarea')
			: document.getElementById(`subr-recipe-textarea-${subrIndex}`);
	textarea.innerText = temp.flat().join(' ');
}

/* calculate and update main sw vals in table */
function calculateSW(ingNameAndBPArray, sw_nodeList, subrIndex = undefined) {
	let tdw_val = get_queryTarget('tdw-val', subrIndex)[0];
	let tf_val = get_queryTarget('tf-val', subrIndex)[0];

	for (var i = 0; i < sw_nodeList.length; i++) {
		sw_nodeList[i].innerText = round_bySize(
			(Number(ingNameAndBPArray[i][1]) / Number(tf_val.innerText)) *
				Number(tdw_val.innerText)
		);
	}
}

/* check if sw nodes are zeroed out, used by updateSW(), update_subrSW() */
function sumOf_swVals_fromTable(swNodes_array) {
	return swNodes_array
		.filter(node => {
			return !node.classList.contains('tmw');
		})
		.map(node => Number(node.innerText))
		.reduce((a, b) => a + b, 0);
}

/* helper for updateSW, returns new_mainIng_swVal for recalculating mainTable tdw-val */
function update_subrSW(userInputCell, subrIndex = undefined) {
	apply_warningChanges(userInputCell);
	if (isWarning()) {
		return;
	}

	let subr_sw_nodeList = get_nodeList('ing-sw', subrIndex);
	let subr_bp_nodeList = get_nodeList('ing-bp', subrIndex);
	let subr_tdw_val = get_queryTarget('tdw-val', subrIndex)[0];
	let subr_tf_val = get_queryTarget('tf-val', subrIndex)[0];
	let nodeType;
	let is_allZeros_swColumn = sumOf_swVals_fromTable(subr_sw_nodeList) == 0;
	let subr_ingNameAndBPArray = (() => {
		nodeType = is_allZeros_swColumn ? 'ing-bp' : 'ing-sw';
		/* !important: must precede get_ingNameAndBPArray() */
		get_inputString(nodeType, subrIndex);
		return get_ingNameAndBPArray(subrIndex);
	})();

	/* if direct mainTable change, calculateSW() and exit */
	if (!userInputCell.matches('.subr')) {
		calculateSW(subr_ingNameAndBPArray, subr_sw_nodeList, subrIndex);
		adjust_subrSW_difference(
			document.getElementById(`subr-wrapper-${subrIndex}`)
		);
		return;
	}

	subr_tdw_val.innerText =
		nodeType == 'ing-sw' && subrIndex !== undefined
			? roundTo(sumOf_swVals_fromTable(subr_sw_nodeList), 3)
			: Array.from(
					document.getElementById(`subr-wrapper-${subrIndex}`)
						.previousElementSibling.children
			  )[3].innerText;

	/* assign new bpVals to each bpNode, then call calculateSW() */
	for (let i = 0; i < subr_bp_nodeList.length; i++) {
		subr_bp_nodeList[i].innerText = subr_ingNameAndBPArray[i][1];
	}
	subr_tf_val.innerText = get_totalFormulaVal(subr_ingNameAndBPArray);
	calculateSW(subr_ingNameAndBPArray, subr_sw_nodeList, subrIndex);

	return subr_tdw_val.innerText;
}

/* called by updateTDW, updateBP */
function updateSW(userInputCell, subrIndex = undefined) {
	apply_warningChanges(userInputCell);
	if (isWarning()) {
		return;
	}

	/* !important: disallows zeroing out asterisked ing-sw cell */
	let is_zeroedOut_asteriskSW =
		userInputCell == undefined
			? false
			: userInputCell.classList.contains('asterisk') &&
			  Number(userInputCell.innerText) == 0;
	if (is_zeroedOut_asteriskSW) {
		userInputCell.innerText = initial_cellValue;
		apply_warningChanges(userInputCell);
		return;
	}

	/* !important: disallows zeroing out all flour ing-sw cells */
	let sw_allZeroes_after_tdwChange =
		document.getElementById('tdw-val').innerText !== 0 &&
		get_nodeList('ing-sw', subrIndex)
			.map(node => Number(node.innerText))
			.reduce((a, b) => a + b, 0) == 0;
	if (userInputCell !== undefined && !sw_allZeroes_after_tdwChange) {
		let queryTarget =
			subrIndex == undefined
				? 'main-ingredients-body'
				: `subr-ingredients-body-${subrIndex}`;
		let ingSW_selectorModifier = subrIndex == undefined ? ':not(.subr)' : '';
		let flour_nodes = Array.from(
			document
				.getElementById(queryTarget)
				.querySelectorAll(`.ing-sw:not(.header)${ingSW_selectorModifier}`)
		).filter(node => {
			let is_flourNode =
				node.previousElementSibling.previousElementSibling.innerText.match(
					/flour/gi
				) !== null;
			let not_totalFlour = !node.matches('.tmw');
			return is_flourNode && not_totalFlour;
		});
		let is_zeroedOut_allFlours =
			roundTo(
				flour_nodes
					.map(node => Number(node.innerText))
					.reduce((a, b) => a + b, 0),
				0
			) == 0;
		if (is_zeroedOut_allFlours) {
			userInputCell.innerText = initial_cellValue;
			apply_warningChanges(userInputCell);
			return;
		}
	}

	/* call calculateSW() on mainTable by first initializing and getting new_mainIng_swVal,
    if updateSW() called on subr, then subrIndex will allow update_subrSW() callback to return the new mainTable swVal,
    get the new parsed_inputString main_ingNameAndBPArray and update mainTable tdw-val,
    then call calculateSW() on the mainTable name/bp array and sw nodeList */

	let new_mainIng_swVal,
		mainTable_sw_nodeList = get_nodeList('ing-sw');
	if (subrIndex !== undefined) {
		new_mainIng_swVal = userInputCell.matches('.ing-bp')
			? null
			: update_subrSW(userInputCell, subrIndex);
		let mainIng_swNode = Array.from(
			document.getElementById(`subr-wrapper-${subrIndex}`)
				.previousElementSibling.children
		)[3];
		mainIng_swNode.innerText =
			new_mainIng_swVal == null ? mainIng_swNode.innerText : new_mainIng_swVal;
	}

	let swSum;
	let main_ingNameAndBPArray = (() => {
		let path_fromMainButton = (() => {
			return userInputCell == undefined
				? false
				: userInputCell.isEqualNode(
						document.getElementById('main-parse-recipe-button')
				  );
		})();
		let direct_tdwChange = (() => {
			return userInputCell == undefined
				? false
				: userInputCell.isEqualNode(get_queryTarget('tdw-val')[0]);
		})();
		swSum =
			path_fromMainButton || direct_tdwChange
				? Number(userInputCell.innerText)
				: sumOf_swVals_fromTable(mainTable_sw_nodeList);
		let path_fromUpdateBP = (() => {
			return userInputCell == undefined
				? false
				: userInputCell.classList.contains('ing-bp');
		})();
		if (swSum == 0 || path_fromUpdateBP) {
			get_inputString('ing-bp');
			return get_ingNameAndBPArray();
		}
		/* !important: this case handles  a direct tdw change when swVals are zeroed out, either
        after mainRecipe(), after zeroing out tdw-val through direct change, after removing last itemRow */
		let is_allZeros_swColumn =
			sumOf_swVals_fromTable(mainTable_sw_nodeList) == 0;
		direct_tdwChange || is_allZeros_swColumn
			? get_inputString('ing-bp')
			: get_inputString('ing-sw');
		return get_ingNameAndBPArray();
	})();

	/* clear old table vals and add the new ones */
	(() => {
		get_queryTarget('tdw-val')[0].innerText = roundTo(swSum, 0);
		let ingredients_body = get_queryTarget('ingredients-body')[0];
		let ingNameAndBP_cellArray = (() => {
			let res = [];
			let names = Array.from(
				ingredients_body.querySelectorAll(
					'.ing-name:not(.header):not(.subr):not(.template)'
				)
			);
			let bps = Array.from(
				ingredients_body.querySelectorAll(
					'.ing-bp:not(.header):not(.subr):not(.template)'
				)
			);
			while (names.length > 0) {
				res.push([names.shift(), bps.shift()]);
			}
			return res;
		})();
		for (let i = 0; i < ingNameAndBP_cellArray.length; i++) {
			ingNameAndBP_cellArray[i][0].innerText = main_ingNameAndBPArray[i][0];
			ingNameAndBP_cellArray[i][1].innerText = main_ingNameAndBPArray[i][1];
		}
		get_queryTarget('tf-val')[0].innerText = get_totalFormulaVal(
			main_ingNameAndBPArray
		);
	})();

	/* finally, get new sw vals */
	calculateSW(main_ingNameAndBPArray, mainTable_sw_nodeList);

	/* get populated subrs and recalculate their sw vals */
	let subr_wrapperArray = Array.from(
		document.querySelectorAll('.subr.wrapper:not(.template)')
	).filter(container => {
		return (
			container.querySelector('.subr.ingredients-body').childElementCount > 0
		);
	});
	for (let i = 0; i < subr_wrapperArray.length; i++) {
		let subrIndex = get_subrIndex(subr_wrapperArray[i]);
		let subr_tdw_val = get_queryTarget('tdw-val', subrIndex)[0];
		let mainIng_swNode = Array.from(
			subr_wrapperArray[i].previousElementSibling.children
		)[3];
		subr_tdw_val.innerText = mainIng_swNode.innerText;
		update_subrSW(userInputCell, subrIndex);
	}
}

/* helper for last operation in updateSW(); adjusts mainIng_swVal and subr_swVal discrepancy */
function adjust_subrSW_difference(subr_wrapper) {
	let mainIng_swVal = Array.from(
		subr_wrapper.previousElementSibling.children
	)[3];
	let subr_tdw_val = subr_wrapper.querySelector('.subr.tdw-val');
	let swVal_diff = Number(
		roundTo(Number(mainIng_swVal.innerText) - Number(subr_tdw_val.innerText), 2)
	);

	if (swVal_diff == 0) {
		return;
	}

	let subrSW_nodes_not_tmw = Array.from(
		subr_wrapper.querySelectorAll(
			'.subr.ing-sw:not(.header):not(.tmw):not(.asterisk):not(.template)'
		)
	);
	let valArray = subrSW_nodes_not_tmw.map(node => Number(node.innerText));
	let largestVal = valArray[0],
		largestVal_index = 0;
	for (let i = 1; i < valArray.length; i++) {
		if (largestVal > valArray[i]) {
			continue;
		}
		largestVal = valArray[i];
		largestVal_index = i;
	}
	subrSW_nodes_not_tmw[largestVal_index].innerText =
		Number(subrSW_nodes_not_tmw[largestVal_index].innerText) + swVal_diff;
	subr_tdw_val.innerText = mainIng_swVal.innerText;
}

/* ---- EVENTHANDLERS and callbacks ---- */

/* global var used by is_CEnode(), focusoutHandler(), validateEntry() */
var CE_classNames =
	'.recipe-name, .method, .tdw-val, .items-name, .items-weight, .items-amount, .ing-bp, .ing-sw';

/* tests whether e.target is a contentEditable node */
function is_CEnode(userInputCell) {
	let CE_className_array = CE_classNames.replace(/\./gi, '')
		.replace(/\,/gi, '')
		.split(' ');
	return CE_className_array.some(name => {
		return userInputCell.classList.contains(name);
	});
}

/* sets userInputCell equal to zero if content is whitespace, empty string */
function writeZero_toEmptyCell(cell) {
	if (
		cell.innerText.match(emptyCellRegex) &&
		!cell.matches('.recipe-name, .method-container, .items-name')
	) {
		cell.innerText = 0;
	}
}

/* helper for focusin-/clickHandler, returns isButtonType boolean for a given button namestring
if node is equal or e.target is a child of element.id == #buttonID */
function isButtonType(buttonID, e) {
	return (
		e.target.matches(`#${buttonID}`) ||
		document.getElementById(buttonID).contains(e.target)
	);
}

/* helper swaps classes for opposite: on/off, visible/hidden, hasArrow/noArrow, active/inactive */
function toggle_className(node, className) {
	let style1, style2;
	switch (className) {
		case 'not_editable':
			(() => {
				style1 = 'not_editable';
				style2 = 'editable';
			})();
			break;
		case 'editable':
			(() => {
				style1 = 'editable';
				style2 = 'not_editable';
			})();
			break;
		case 'visible':
			(() => {
				style1 = 'visible';
				style2 = 'hidden';
			})();
			break;
		case 'hidden':
			(() => {
				style1 = 'hidden';
				style2 = 'visible';
			})();
			break;
		case 'hasArrow':
			(() => {
				style1 = 'hasArrow';
				style2 = 'noArrow';
			})();
			break;
		case 'noArrow':
			(() => {
				style1 = 'noArrow';
				style2 = 'hasArrow';
			})();
			break;
		case 'active':
			(() => {
				style1 = 'active';
				style2 = 'inactive';
			})();
			break;
		case 'inactive':
			(() => {
				style1 = 'inactive';
				style2 = 'active';
			})();
			break;
	}
	let hasStyle = node.classList.replace(style2, style1);
	if (!hasStyle) {
		node.classList.add(style1);
	}
}

/* helper applies content-editable style, used by validateEntry, createRecipe, createSubrecipe */
function apply_CEstyle() {
	if (isWarning()) {
		let CEnodes_noWarning = Array.from(
			document.querySelectorAll(CE_classNames)
		).filter(node => {
			return !node.matches('.warning');
		});
		CEnodes_noWarning.forEach(node => {
			node.contentEditable = 'false';
			toggle_className(node, 'not_editable');
		});
		return;
	}

	Array.from(document.querySelectorAll(CE_classNames))
		.filter(node => {
			return !node.matches(
				'.template, .header, .tmw, .ing-bp.asterisk, .subr.tdw-val, .subr.recipe-name'
			);
		})
		.forEach(node => {
			node.contentEditable = 'true';
			toggle_className(node, 'editable');
		});

	/* toggle sw vals' contentEditability off if tdw-val == 0 */
	if (get_queryTarget('tdw-val')[0].innerText == 0) {
		Array.from(
			document.querySelectorAll('.ing-sw:not(.header):not(.tmw):not(.template)')
		).forEach(node => {
			node.contentEditable = 'false';
			toggle_className(node, 'not_editable');
		});
	}

	/* toggle swVal, tdwVal editability off if itemBody.childElementCount > 0 */
	if (document.getElementById('items-body').childElementCount > 0) {
		Array.from(
			document.querySelectorAll(
				'.tdw-val, .ing-sw:not(.header):not(.tmw):not(.template)'
			)
		).forEach(node => {
			node.contentEditable = 'false';
			toggle_className(node, 'not_editable');
		});
	}
}

/* called by focusoutHandler, validates contentEditable div innerText updates */
function validateEntry(e) {
	if (
		e.target.matches('.recipe.container') ||
		e.target.matches('.method.container')
	) {
		return;
	}
	if (e.target.innerText == initial_cellValue) {
		return;
	}

	let subr_wrapperArray = Array.from(
		document.querySelectorAll('.subr.wrapper:not(.template)')
	);
	let possible_subrMatch = subr_wrapperArray.filter(node => {
		return node.contains(e.target);
	})[0];
	let subrIndex;
	if (possible_subrMatch !== undefined) {
		subrIndex = get_subrIndex(possible_subrMatch);
	}

	writeZero_toEmptyCell(e.target);
	e.target.innerText = e.target.innerText.trim();

	let is_main_tdwCell = e.target.isEqualNode(
		document.getElementById('tdw-val')
	);
	let is_itemWeightOrAmountCell =
		e.target.matches('.items-weight') || e.target.matches('.items-amount');
	let is_bpCell = e.target.classList.contains('ing-bp');
	let is_swCell = e.target.classList.contains('ing-sw');

	switch (true) {
		/* no subrIndex for updateTDW since it's only a mainTable element */
		case is_main_tdwCell:
			updateTDW(e.target);
			break;
		case is_itemWeightOrAmountCell:
			updateTDW_fromItems();
			break;
		case is_bpCell:
			updateBP(e.target, subrIndex);
			break;
		case is_swCell:
			updateSW(e.target, subrIndex);
			break;
	}
}

/* set initial_cellValue if is_CEnode */
function focusinHandler(e) {
	if (is_CEnode(e.target)) {
		initial_cellValue = e.target.innerText;
	}
}

/* check CEnodes for changes, push state to undoStack */
function focusoutHandler(e) {
	exit_cellValue = e.target.innerText;

	if (!is_CEnode(e.target)) {
		last_action = e.target;
		return;
	}

	validateEntry(e);
	apply_CEstyle();
	saveState();

	/* let table_wrapper = document.querySelector('.table-wrapper');
    if (undoStack[undoStack.length - 1].isEqualNode(table_wrapper.querySelector('.table-container'))) {
        undoStack.pop();
    } */
	last_action = e.target;
}

/* handles clicks to all non-CEnodes */
function clickHandler(e) {
	/* important! if ctrl-z/y, last_action needs to be updated to undo/redo click */
	if (
		isButtonType('undo-toolbar-button', e) ||
		isButtonType('redo-toolbar-button', e)
	) {
		last_action = isButtonType('undo-toolbar-button', e)
			? document.querySelector('#undo-toolbar-button')
			: document.querySelector('#redo-toolbar-button');
	}

	/* close drop-menu if open and next click is not a save-drop-menu button or save-button-toolbar
    important!: must be evaluated at top of clickHandler() */
	let save_dropMenu = document.getElementById('save-drop-menu');
	let is_saveMenuButton = save_dropMenu.contains(e.target);
	if (!is_saveMenuButton && !isButtonType('save-toolbar-button', e)) {
		toggle_className(save_dropMenu, 'hidden');
	}

	switch (true) {
		case is_CEnode(e.target):
			break;

		case e.target.matches('#main-parse-recipe-button'):
			mainRecipe_button();
			undoStack = [];
			break;
		case e.target.matches('#main-load-recipe-button'):
			loadRecipe_button();
			undoStack = [];
			break;
		case e.target.matches('.subr-parse-recipe-button'):
			subRecipe_button(e);
			break;
		case e.target.matches('.remove-subrecipe-button'):
			remove_subRecipe(e.target);
			break;
		case e.target.matches('.remove-items-button'):
			remove_itemRow(e.target);
			break;

		case isButtonType('undo-toolbar-button', e) ||
			isButtonType('redo-toolbar-button', e):
			undoRedoFunctionality(e);
			break;
		case isButtonType('add-items-button', e):
			add_itemRow();
			break;
		case isButtonType('load-toolbar-button', e):
			loadRecipe_button();
			undoStack = [];
			break;
		case isButtonType('save-toolbar-button', e):
			save_dropMenu.matches('.hidden')
				? toggle_className(save_dropMenu, 'visible')
				: toggle_className(save_dropMenu, 'hidden');
			break;

		case save_dropMenu.contains(e.target):
			switch (true) {
				case isButtonType('ios-user-save-message', e):
					document.querySelector('#ios-user-modal').classList.toggle('active');
					toggle_className(save_dropMenu, 'hidden');
					break;
				case isButtonType('save-spreadsheet', e):
					saveRecipe('spreadsheet');
					break;
				case isButtonType('save-csv', e):
					saveRecipe('csv');
					break;
				case isButtonType('save-json', e):
					saveRecipe();
					break;
			}
			break;
		case e.target.matches('#ios-user-modal-close-button'):
			document.querySelector('#ios-user-modal').classList.toggle('active');
			break;

		case e.target.matches(
			'.arrowbox:not(.subr):not(.header):not(.template):not(.tmw):not(.asterisk)'
		) ||
			e.target.matches(
				'.ing-name:not(.subr):not(.header):not(.template):not(.tmw):not(.asterisk)'
			):
			e.target.parentElement.matches('.active')
				? toggle_className(e.target.parentElement, 'inactive')
				: (() => {
						toggle_className(e.target.parentElement, 'active');
						e.target.parentElement.nextElementSibling.scrollIntoView();
				  })();
			break;

		case e.target.matches('.theme-switch'):
			e.target.classList.toggle('dark-mode');
			(() => {
				e.target.matches('.dark-mode')
					? document.documentElement.setAttribute('data-theme', 'dark-mode')
					: document.documentElement.setAttribute('data-theme', 'light-mode');
			})();
			break;

		case e.target.matches('.quickstart-link span'):
			document.querySelector('#quickstart-modal').classList.toggle('active');
			break;
		case e.target.matches('#quickstart-modal-close-button'):
			document.querySelector('#quickstart-modal').classList.toggle('active');
			break;

		case e.target.matches('.topic-button') ||
			e.target.matches('.topic-button-text') ||
			e.target.matches('.topic-button-caret'):
			e.target.matches('.topic-button')
				? (() => {
						e.target.classList.toggle('active');
				  })()
				: (() => {
						e.target.parentElement.classList.toggle('active');
				  })();
			break;
		case e.target.matches('.faq-link'):
			document.querySelector('#faq-modal').classList.toggle('active');
			if (document.querySelector('#quickstart-modal').matches('.active')) {
				document.querySelector('#quickstart-modal').classList.toggle('active');
			}
			break;
		case e.target.matches('#faq-modal-close-button'):
			document.querySelector('#faq-modal').classList.toggle('active');
			break;
	}

	if (!e.target.matches('#main-parse-recipe-button')) {
		saveState();
	}

	/* store last visited node for undoRedo functionality */
	if (!is_CEnode(e.target)) {
		last_action = e.target;
	}
}

function keydownHandler(e) {
	let isMethodContainer = e.target.matches('.method.container');
	let isRecipeTextarea = e.target.matches('input[type=textarea]');
	let is_ctrlZ = e.ctrlKey && e.key === 'z';
	let is_ctrlY = e.ctrlKey && e.key === 'y';

	switch (true) {
		case is_ctrlZ:
			e.preventDefault();
			document.getElementById('undo-toolbar-button').click();

			break;
		case is_ctrlY:
			e.preventDefault();
			document.getElementById('redo-toolbar-button').click();

			break;
		case e.keyCode == 13 && isMethodContainer:
			break;
		case e.keyCode == 13 && isRecipeTextarea:
			e.target.blur();
			e.target.parentElement.matches('.subr')
				? e.target.parentElement
						.querySelector('.subr-parse-recipe-button')
						.click()
				: e.target.parentElement
						.querySelector('.main-parse-recipe-button')
						.click();
			break;
		case e.keyCode == 13 && !(isMethodContainer || isRecipeTextarea):
			e.target.blur();
			break;
		default:
			return;
	}
}

/* detect if iOS device */
function is_iOS() {
	return (
		[
			'iPad Simulator',
			'iPhone Simulator',
			'iPod Simulator',
			'iPad',
			'iPhone',
			'iPod',
		].includes(navigator.platform) ||
		/* iPad on iOS 13 detection */
		(navigator.userAgent.includes('Mac') && 'ontouchend' in document)
	);
}

function assignEventListeners() {
	let table_wrapper = document.querySelector('.table-wrapper');
	let body = document.querySelector('.body');

	table_wrapper.addEventListener('focusin', focusinHandler);
	table_wrapper.addEventListener('focusout', focusoutHandler);

	body.addEventListener('click', clickHandler);
	body.addEventListener('keydown', keydownHandler);

	if (is_iOS()) {
		let iOS_userSaveButton = document.querySelector('#ios-user-save-message');
		iOS_userSaveButton.classList.add('visible');
	}
}

/* ---- TABLE ACTIONS and helpers ---- */

/* helpers for remove buttons (itemsContainer, subrecipeContainer) */
function get_parentNode_forRemoval(cell) {
	let queryTarget = cell.matches('.remove-subrecipe-button')
		? '.subr.wrapper:not(.template)'
		: '.items.row:not(.template)';
	return Array.from(document.querySelectorAll(queryTarget)).filter(wrapper => {
		return wrapper.contains(cell);
	})[0];
}

function mainRecipe_button() {
	let table_wrapper = document.querySelector('.table-wrapper');
	let toolbarContainer = document.querySelector('.toolbar-container');
	let itemsContainer = document.querySelector('#items-container');
	let itemsBody = document.getElementById('items-body');
	let main_ingBody = document.getElementById('main-ingredients-body');

	toggle_className(table_wrapper, 'hidden');
	toggle_className(toolbarContainer, 'hidden');

	main_ingBody.innerHTML = '';
	itemsBody.innerHTML = '';

	let err;
	try {
		buildTable(get_ingNameAndBPArray());
	} catch (err) {
		if (document.getElementById('main-recipe-textarea').innerText == '') {
			return;
		}

		return;
	}

	toggle_className(table_wrapper, 'visible');
	toggle_className(toolbarContainer, 'visible');
	toggle_className(itemsContainer, 'hidden');

	updateSW();
	apply_CEstyle();

	let table_container = table_wrapper.querySelector('.table-container');
	table_container.scrollIntoView();
}

/* helper toggles arrow on main ingredient if subr-ingredients-body has rows, used by subrecipe add/remove */
function toggle_mainIng_arrow(subr_wrapper) {
	let arrowContainer =
		subr_wrapper.previousElementSibling.querySelector('.arrowbox');
	let hasRows =
		subr_wrapper.querySelector('.subr.ingredients-body').childElementCount > 0;
	let arrow_className = hasRows ? 'hasArrow' : 'noArrow';
	toggle_className(arrowContainer, arrow_className);
}

function subRecipe_button(e) {
	if (isWarning()) {
		return;
	}

	let subrIndex = get_subrIndex(e.target);
	let subr_wrapper = document.getElementById(`subr-wrapper-${subrIndex}`);
	let subr_userInputContainer = subr_wrapper.querySelector(
		'.subr.user-input-container'
	);
	let subr_tableContainer = subr_wrapper.querySelector('.subr.table-container');

	let err;
	try {
		buildTable(get_ingNameAndBPArray(subrIndex), subrIndex);
	} catch (err) {
		if (
			document.getElementById(`subr-recipe-textarea-${subrIndex}`).innerText ==
			''
		) {
			return;
		}

		return;
	}

	toggle_className(subr_userInputContainer, 'hidden');
	toggle_className(subr_tableContainer, 'visible');

	/* important! update_SW() calls update_subrSW() on this node
    and gets the new swVal to repop the sw col in mainTable */
	updateSW(e.target, subrIndex);
	apply_CEstyle();
	toggle_mainIng_arrow(subr_wrapper);
}

function remove_subRecipe(removeButton) {
	if (isWarning()) {
		return;
	}

	let subr_wrapper = get_parentNode_forRemoval(removeButton);
	let subr_tableContainer = subr_wrapper.querySelector('.subr.table-container');
	let subr_userInputContainer = subr_wrapper.querySelector(
		'.subr.user-input-container'
	);

	toggle_className(subr_userInputContainer, 'visible');
	toggle_className(subr_tableContainer, 'hidden');
	subr_wrapper.querySelector('.subr.ingredients-body').innerHTML = '';
	toggle_mainIng_arrow(subr_wrapper);
}

var itemRowCounter = 0;

function add_itemRow() {
	if (isWarning()) {
		return;
	}

	let itemsContainer = document.getElementById('items-container');
	let itemsBody = document.getElementById('items-body');
	let numItems = itemsBody.childElementCount;
	let new_itemRow = document
		.getElementById('items-row-template')
		.cloneNode(true);
	let new_itemRow_childArray = Array.from(new_itemRow.children);

	if (numItems == 0) {
		toggle_className(itemsContainer, 'visible');
	}
	toggle_className(new_itemRow, 'visible');
	new_itemRow.id = 'items-row-' + itemRowCounter;
	itemRowCounter++;
	/* important! calculateTDW() filters out template row/cells if userInputCell matches .items-weight/.items-amount */
	new_itemRow.classList.remove('template');
	new_itemRow_childArray.forEach(child => {
		child.classList.remove('template');
	});
	itemsBody.appendChild(new_itemRow);

	apply_CEstyle();
}

function updateTDW_fromItems() {
	let tdw_val = get_queryTarget('tdw-val')[0];
	let new_tdw = calculateTDW();
	tdw_val.innerText = new_tdw;
	updateSW(tdw_val);

	/* handles itemWeight, itemAmount NaN changes */
	if (tdw_val.innerText == 'NaN') {
		tdw_val.innerText = 'Error';
		tdw_val.classList.remove('warning');
		tdw_val.contentEditable = 'false';
	}
}

function remove_itemRow(removeButton) {
	if (isWarning()) {
		return;
	}

	let itemsContainer = document.getElementById('items-container');
	let itemsBody = document.getElementById('items-body');
	let item = get_parentNode_forRemoval(removeButton);

	itemsBody.removeChild(item);

	if (itemsBody.childElementCount == 0) {
		toggle_className(itemsContainer, 'hidden');
		/* document.querySelector('.table-wrapper').insertBefore(itemsContainer, document.getElementById('items-row-template'));*/
		get_queryTarget('tdw-val')[0].innerText = 0;
		Array.from(
			document.querySelectorAll('.ing-sw:not(.header):not(.template)')
		).forEach(node => {
			node.innerText = 0;
		});
		apply_CEstyle();
		return;
	}

	updateTDW_fromItems();
	apply_CEstyle();
}
