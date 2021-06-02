'use strict';

function buildTable(ingNameAndBPArray, subrIndex = undefined) {
	if (ingNameAndBPArray == undefined) {
		return;
	}

	let ingredients_body =
		subrIndex == undefined
			? document.getElementById('main-ingredients-body')
			: document.getElementById(`subr-ingredients-body-${subrIndex}`);
	let ingredientsRow_template =
		subrIndex == undefined
			? document.getElementById('ingredients-row-template')
			: document.getElementById('subr-ingredients-row-template');
	let subr_template = document.getElementById('subr-wrapper-template');
	let numRows = ingNameAndBPArray.length;

	for (var i = 0; i < numRows; i++) {
		let newRow = ingredientsRow_template.cloneNode(true);
		ingredients_body.appendChild(newRow);
		newRow.id =
			subrIndex == undefined
				? 'ingredients-row-' + i
				: 'subr-ingredients-row-' + i;

		let newRow_cells = Array.from(newRow.children);
		newRow_cells.forEach(cell => {
			cell.classList.remove('template');
			/* !important: adds a flag to asterisked-tmw and 'total flour'-tmw row cells for udpaters, apply_CEstyle use */
			if (i == 0 && ingNameAndBPArray[0][0].search('total flour') !== -1) {
				cell.classList.add('tmw');
			} else if (i == 0 && ingNameAndBPArray[0][0].match(/\*/gi) !== null) {
				cell.classList.add('asterisk');
			}
		});
		/* !important: subr cells start at index 0 (no arrowbox...) */
		let j = subrIndex == undefined ? 1 : 0;
		newRow_cells[j].innerText = ingNameAndBPArray[i][0];
		newRow_cells[j + 1].innerText = ingNameAndBPArray[i][1];

		if (subrIndex == undefined) {
			if (i == 0) {
				continue;
			}
			let newSubr = subr_template.cloneNode(true);
			ingredients_body.appendChild(newSubr);
			newSubr.id = 'subr-wrapper-' + i;
			newSubr.classList.remove('template');

			newSubr.querySelectorAll('*').forEach(node => {
				if (node.id.endsWith('-')) {
					node.id += i;
				}
			});
			newSubr.querySelector('.recipe-name').innerText = Array.from(
				newSubr.previousElementSibling.children
			)[1].innerText;
		}
	}

	let tdw_val = get_queryTarget('tdw-val', subrIndex)[0];
	let tf_val = get_queryTarget('tf-val', subrIndex)[0];
	tdw_val.innerText =
		subrIndex == undefined
			? 0
			: Number(
					Array.from(
						document.getElementById(`subr-wrapper-${subrIndex}`)
							.previousElementSibling.children
					)[3].innerText
			  );
	tf_val.innerText = get_totalFormulaVal(ingNameAndBPArray);
}

/* cache table content innerText values
return object currentTable: {recipeName, totalFormula, items, ingredients, method} */
function cacheCurrentTable() {
	/* helper function, returns flat array of ingredients-, items-body innerTexts */
	function getBodyContents(queryTarget, bodyClass) {
		let res = [],
			isSubr = queryTarget !== document && bodyClass == '.ingredients-body';
		let bodyChildren_array = Array.from(
			queryTarget.querySelector(bodyClass).children
		);
		if (!isSubr) {
			bodyChildren_array = bodyChildren_array.filter(child => {
				return !child.matches('.subr');
			});
		}
		bodyChildren_array.forEach(row => {
			row = Array.from(row.children);
			if (!isSubr) {
				row = row.slice(1);
			}
			row = row.map(node => node.innerText);
			res.push(row);
		});
		return res;
	}

	/* get recipe-name, totals, method */
	let recipename = document.querySelector('.recipe-name').innerText;
	let totalDoughWeight = document.querySelector('.tdw-val').innerText;
	let totalFormula = document.querySelector('.tf-val').innerText;
	let method = document.querySelector('.method.container').innerText;

	/* get itemArray, ingredientArray */
	let itemsArray = getBodyContents(document, '.items-body');
	let ingredientsArray = getBodyContents(document, '.ingredients-body');

	/* build subrecipeArray */
	let subrecipeArray = [];
	let subr_wrapperArray = Array.from(
		document.querySelectorAll('.subr.table-container:not(.template)')
	).filter(subr => {
		return subr.querySelector('.subr.ingredients-body').childElementCount > 0;
	});
	subr_wrapperArray.forEach(subr => {
		let res = getBodyContents(subr, '.ingredients-body');
		let subr_tdw_text = subr.querySelector('.subr.tdw-text').innerText;
		let subr_tf_text = subr.querySelector('.subr.tf-text').innerText;
		let subr_tdw_val = subr.querySelector('.subr.tdw-val').innerText;
		let subr_tf_val = subr.querySelector('.subr.tf-val').innerText;
		let subr_mainIngName = subr.querySelector('.subr.recipe-name').innerText;
		let subrecipe = {
			main_ingName: subr_mainIngName,
			tdw: { text: subr_tdw_text, val: subr_tdw_val },
			tf: { text: subr_tf_text, val: subr_tf_val },
			subr_ingNameAndBPArray: res,
		};
		subrecipeArray.push(subrecipe);
	});

	/* create table contents object currentTable */
	let currentTable = {
		recipeName: recipename,
		totalDoughWeight: totalDoughWeight,
		totalFormula: totalFormula,
		items: itemsArray,
		ingredients: ingredientsArray,
		subrecipes: subrecipeArray,
		method: method,
	};
	return currentTable;
}

/* creates file for saveRecipe download
content is spreadsheet, CSV, or JSON */
function downloadToFile(content, filename, contentType) {
	let a = document.createElement('a');
	let file = new Blob([content], { type: contentType });

	a.href = URL.createObjectURL(file);
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
}

/* write cacheCurrentTable to .txt file and prompt to save on user local machine */
function saveRecipe(fileType = 'json') {
	let currentTable = (() => {
		switch (fileType) {
			case 'spreadsheet':
				return spreadsheetify();
			case 'csv':
				return spreadsheetify(true);
			case 'json':
				return JSON.stringify(cacheCurrentTable());
		}
	})();
	let recipename_txt = document.querySelector('.recipe-name').innerText;
	downloadToFile(
		currentTable,
		`bbf_${recipename_txt}_${fileType}.txt`,
		'text/plain'
	);
}

/* ---- LOAD TABLE ---- */

/* create a new table from cacheCurrentTable output */
function readJSONIntoTable(myRecipeObject) {
	/* items, ingredients vals are arrays of arrays, rest are strings */
	let recipeName = myRecipeObject.recipeName;
	let totalDoughWeight = myRecipeObject.totalDoughWeight;
	let totalFormula = myRecipeObject.totalFormula;
	let items = myRecipeObject.items;
	let ingredients = myRecipeObject.ingredients;
	let subrecipes = myRecipeObject.subrecipes;
	let method = myRecipeObject.method;

	/* build table */
	let inputString = '';
	for (let i = 0; i < ingredients.length; i++) {
		if (ingredients[i][0] === 'total flour') {
			continue;
		}
		inputString += ingredients[i].slice(0, 2).reverse().join(' ');
		inputString += ' ';
	}
	document.getElementById('main-recipe-textarea').innerText = inputString;
	document.getElementById('main-parse-recipe-button').click();

	/* write recipename, methodbody, tdw_val and tf_val to new table */
	document.querySelector('.recipe-name').innerText = recipeName;
	document.querySelector('.tdw-val').innerText = totalDoughWeight;
	document.querySelector('.tf-val').innerText = totalFormula;
	document.querySelector('.method.container').innerText = method;

	/* get swVals  */
	updateSW(get_queryTarget('tdw-val')[0]);

	/* addItems */
	for (let i = 0; i < items.length; i++) {
		document.getElementById('add-items-button').click();
		let itemsRow_nodeArray = Array.from(
			document.querySelector('.items-body').lastElementChild.children
		).slice(1);
		for (let j = 0; j < itemsRow_nodeArray.length; j++) {
			itemsRow_nodeArray[j].innerText = items[i][j];
		}
	}

	/* add subrecipes */
	for (let i = 0; i < subrecipes.length; i++) {
		let main_ingName = subrecipes[i].main_ingName;
		let main_ingName_node = Array.from(
			document.querySelectorAll(
				'.ing-name:not(.header):not(.template):not(.subr)'
			)
		).filter(node => {
			return node.innerText == main_ingName;
		})[0];
		let subr_wrapper = main_ingName_node.parentElement.nextElementSibling;
		let subrIndex = get_subrIndex(subr_wrapper);
		let subr_inputString = '';
		subrecipes[i].subr_ingNameAndBPArray.forEach(subarr => {
			let isTMW = subarr[0] === 'total flour';
			if (!isTMW) {
				subr_inputString += subarr.slice(0, 2).reverse().join(' ') + ' ';
			}
		});
		subr_wrapper.querySelector(`#subr-recipe-textarea-${subrIndex}`).innerText =
			subr_inputString;
		subr_wrapper
			.querySelector(`#subr-parse-recipe-button-${subrIndex}`)
			.click();
	}

	apply_CEstyle();
	document.querySelector('.table-container').scrollIntoView();
}

/* helper clicks hidden file input */
function loadRecipe_button() {
	document.getElementById('load-recipe-file-reader').click();
}

/* get recipeObject from FileReader and call readJSONIntoTable to load */
function readFile(e) {
	let file = e.target.files[0];
	if (!file) {
		return;
	}

	let reader = new FileReader();
	reader.onload = e => {
		let myRecipeObject = e.target.result;
		document.querySelector('.items-body').innerHTML = '';
		document.querySelector('.ingredients-body').innerHTML = '';
		document.querySelector('.input-warning').style.display = '';
		readJSONIntoTable(JSON.parse(myRecipeObject));
	};
	reader.readAsText(file);
}

/* ---- GENERATE SPREADSHEET, CSV ---- */

/* helper returns subrecipe object values given subrecipeObj[subObjIndex], key--string
keys: 'recipe-name', 'tdw-text/val', 'tf-text/val', 'ingredients */
function getSubrVal(mySubrecipeObject, key) {
	if (mySubrecipeObject == undefined) {
		return;
	}

	let subr_recipeName = mySubrecipeObject.main_ingName;
	let subr_tdw_text = mySubrecipeObject.tdw.text;
	let subr_tdw_val = mySubrecipeObject.tdw.val;
	let subr_tf_text = mySubrecipeObject.tf.text;
	let subr_tf_val = mySubrecipeObject.tf.val;
	let subr_ingredients = mySubrecipeObject.subr_ingNameAndBPArray;

	switch (key) {
		case 'recipe-name':
			return subr_recipeName;
		case 'tdw-text':
			return subr_tdw_text;
		case 'tdw-val':
			return subr_tdw_val;
		case 'tf-text':
			return subr_tf_text;
		case 'tf-val':
			return subr_tf_val;
		case 'ingredients':
			return subr_ingredients;
	}
}

/* builds spreadsheet string, ex. "recipeName,tdw-text,tdw-val\n,tf-text,tf-val\n..."
returns csv with formulas or plain csv (isCSV == true)
subrObjIndex, final_rowCount parameters determined by getSS_String(),
isCSV determined by user selection on dropup-content-save */
function buildSS_String(
	isCSV = false,
	isSubr = false,
	subr_objIndex = undefined,
	final_rowCount = undefined
) {
	/* cachedTable is all table-bg content, subrecipes is a nested object of cachedTable */
	let cachedTable = cacheCurrentTable();
	let subrecipes = cachedTable.subrecipes;

	let currentTable = isSubr == false ? cachedTable : subrecipes[subr_objIndex];
	let recipeName =
		isSubr == false
			? currentTable.recipeName
			: getSubrVal(currentTable, 'recipe-name');
	let totalDoughWeight =
		isSubr == false
			? currentTable.totalDoughWeight
			: getSubrVal(currentTable, 'tdw-val');
	let totalFormula =
		isSubr == false
			? currentTable.totalFormula
			: getSubrVal(currentTable, 'tf-val');
	let ingredients =
		isSubr == false
			? currentTable.ingredients
			: getSubrVal(currentTable, 'ingredients');

	/* items, method variables are unique to main table contents */
	let items = isSubr == false ? currentTable.items : undefined;
	let method = isSubr == false ? currentTable.method : '';

	/* wrap recipeName, method in quotes to avoid csv comma import issues */
	method = `"${method}",,,`;

	/* header rows */
	let itemHeader =
		isCSV == true
			? 'item name,weight,amount\n'
			: 'item name,weight (g),amount\n';
	let ingredientHeader = "ingredient,baker's %,weight (g)\n";

	/* tdw, tf text */
	let tdw_text =
		isSubr == false
			? 'total dough weight (g):'
			: getSubrVal(currentTable, 'tdw-text');
	let tf_text =
		isSubr == false ? 'total formula %:' : getSubrVal(currentTable, 'tf-text');

	/* initialize string, blankRow, rowCount -- !important:
    (used to determine formulas for SW col) */
	let ss_CSV = new String();
	let blankRow = ',,,\n';
	final_rowCount == undefined
		? (final_rowCount = 1)
		: (final_rowCount = final_rowCount);
	let rowCount = isSubr == false ? 1 : final_rowCount;

	/* flag totalDoughWeight field and replace after item calculations */
	ss_CSV += recipeName + ',' + tdw_text + ',TDW-FLAG\n';
	rowCount++;

	/* flag totalFormula field and replace after ingredient calculations */
	ss_CSV += ',' + tf_text + ',TF-FLAG\n';
	rowCount++;

	ss_CSV += blankRow;
	rowCount++;

	/* add item section if main table, else skip (subrecipes don't have items...) */
	let itemStartIndex, itemEndIndex;
	if (isSubr == false) {
		ss_CSV += itemHeader;
		rowCount++;

		/* get itemRows ['name'--string, 'weight'--num, 'unit'--string, 'amount'--num]
        !important: itemStart/EndIndex used to define totalDoughWeight, don't remove */
		itemStartIndex = rowCount;
		for (var i = 0; i < items.length; i++) {
			let itemName = items[i][0];
			let itemWeight =
				isCSV == true
					? items[i][1]
					: unitConvert([
							parseUserInput(items[i][1] + ' ' + itemName, undefined, true),
					  ]).flat()[0];
			let itemAmount = items[i][2];
			let new_itemRow = itemName + ',' + itemWeight + ',' + itemAmount + '\n';
			ss_CSV += new_itemRow;
			rowCount++;
		}
		itemEndIndex = rowCount - 1;
		ss_CSV += blankRow;
		rowCount++;
	}

	/* tdw_val is formula that sums item weights if there are items
    if no items, tdw_val is whatever val cached
    if tdw_val cached is emptyString, set tdw_val = 0
    if CSV export use cached TDW defined at top of function */
	totalDoughWeight =
		isCSV == true
			? totalDoughWeight
			: (() => {
					let res;
					if (items == undefined || items.length == 0) {
						/* C50 arbitrarily ensures coverage for main table ingredient column match function */
						res =
							isSubr == false
								? 0
								: `"=index(A1:C50, match(""${recipeName}"", A1:A50, 0), 3)"`;
					} else {
						res =
							isSubr == false
								? '"=sumproduct($B' +
								  itemStartIndex +
								  ':$B' +
								  itemEndIndex +
								  ', $C' +
								  itemStartIndex +
								  ':$C' +
								  itemEndIndex +
								  ')"'
								: `"=index(A1:C50, match(""${recipeName}"", A1:A50, 0), 3)"`;
					}
					return res;
			  })();
	ss_CSV = ss_CSV.replace('TDW-FLAG', totalDoughWeight);

	/* add ingredientHeader */
	ss_CSV += ingredientHeader;
	rowCount++;

	/* if first ingRow is 'total flour', start indexing BPs for totalFormula on next row */
	let bpStartIndex =
		ingredients[0][0] === 'total flour' ? rowCount + 1 : rowCount;
	for (i = 0; i < ingredients.length; i++) {
		/* precision is the rounding parameter in spreadsheet =ROUND(INPUT, PRECISION) formula */
		let precision = (() => {
			switch (true) {
				case Number(ingredients[i][2]) >= 100:
					return 0;
				case Number(ingredients[i][2]) < 100 && Number(ingredients[i][2]) >= 10:
					return 1;
				case Number(ingredients[i][2]) < 10 && Number(ingredients[i][2]) >= 1:
					return 2;
				case Number(ingredients[i][2]) < 1:
					return 3;
			}
		})();

		let tdw_location = isSubr == false ? '$C$1' : '$C$' + final_rowCount;
		let tf_location = isSubr == false ? '$C$2' : '$C$' + (final_rowCount + 1);

		/* !important: BP_formula, SW_formula applied ot 'total flour' if present, sums all bp/sw with 'flour' ingname */
		let BP_formula =
			ingredients[i][0] === 'total flour'
				? 'TOTAL-FLOUR-BP-FLAG'
				: ingredients[i][1];
		let SW_formula =
			ingredients[i][0] === 'total flour'
				? 'TOTAL-FLOUR-SW-FLAG'
				: '"=round($B' +
				  rowCount +
				  '/' +
				  tf_location +
				  '*' +
				  tdw_location +
				  ',' +
				  precision +
				  ')"';

		/* if CSV export use cached ingBP, ingSW */
		let ingBP = isCSV == true ? ingredients[i][1] : BP_formula;
		let ingSW = isCSV == true ? ingredients[i][2] : SW_formula;

		let new_ingRow = ingredients[i][0] + ',' + ingBP + ',' + ingSW + '\n';
		ss_CSV += new_ingRow;
		rowCount++;
	}
	let bpEndIndex = rowCount - 1;
	totalFormula =
		isCSV == true
			? totalFormula
			: `"=round(sum(B${bpStartIndex}:B${bpEndIndex}), 3)"`;

	/* find all matches of 'flour' rows and replaces TOTAL-FLOUR-SW-FLAG
    with formula structured: ex., "=sumif(A9:A15, "*flour*", C9:C15)" */
	let totalFlour_BP_formula = `"=sumif(\$A${bpStartIndex}:\$A${bpEndIndex}, ""\*flour\*"", \$B${bpStartIndex}:\$B${bpEndIndex})"`;
	let totalFlour_SW_formula = `"=sumif(\$A${bpStartIndex}:\$A${bpEndIndex}, ""\*flour\*"", \$C${bpStartIndex}:\$C${bpEndIndex})"`;

	ss_CSV = ss_CSV.replace('TOTAL-FLOUR-BP-FLAG', totalFlour_BP_formula);
	ss_CSV = ss_CSV.replace('TOTAL-FLOUR-SW-FLAG', totalFlour_SW_formula);

	/* if CSV export use cached totalFormula */
	ss_CSV = ss_CSV.replace('TF-FLAG', totalFormula);

	ss_CSV += blankRow;
	rowCount++;

	/* add method if main table */
	if (isSubr == false) {
		ss_CSV += 'method:,,,\n';
		rowCount++;
		ss_CSV += method + '\n';
		rowCount++;
		ss_CSV += blankRow;
		rowCount++;
	}

	/* !important: rowCount is final_rowCount in successive iterations of buildSS_String called by getSS_String */
	let mySSArray = [rowCount, ss_CSV];
	return mySSArray;
}

/* get a CSV with formulas for spreadsheet import
if optional parameter isCSV == true, no formulas just verbatim table contents */
function spreadsheetify(isCSV = false) {
	/* !important: for getSS_String input */
	let cachedTable = cacheCurrentTable();
	let subrecipes = cachedTable.subrecipes;

	/* helper generates spreadsheet string, optional parameter n is number of subrecipe objects cached */
	function getSS_String(n = 0) {
		if (n == 0) {
			/* isCSV param defined by saveRecipe() function,
            buildSS_String returns array structured [final_rowCount, ss_String] */
			return buildSS_String(isCSV)[1];
		} else {
			/* initial case */
			let ss_String = clone(buildSS_String(isCSV)[1]);
			let init_final_rowCount = clone(buildSS_String(isCSV)[0]);
			let ss_Array = buildSS_String(isCSV, true, 0, init_final_rowCount);
			let final_rowCount = ss_Array[0];
			ss_String += clone(ss_Array[1]);

			/* n-1 possible subrecipe array entries left after initialization */
			for (var i = 1; i < n; i++) {
				ss_Array = buildSS_String(isCSV, true, i, final_rowCount);
				final_rowCount = ss_Array[0];
				ss_String += clone(ss_Array[1]);
			}
			return ss_String;
		}
	}
	return getSS_String(subrecipes.length);
}
