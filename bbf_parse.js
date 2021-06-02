'use strict';

/* ---- GENERAL UTILITIES ---- */

/* clone array utility */
function clone(myArray) {
	return JSON.parse(JSON.stringify(myArray));
}

/* rounding utility functions */
function roundTo(myNum, numberOfPlaces) {
	if (myNum < 1 && numberOfPlaces == 0) {
		return '0';
	}

	let numSpread = [...String(myNum)];
	let dotIndex = numSpread.indexOf('.');
	if (dotIndex == -1) {
		return String(myNum);
	}

	let afterDot_string = numSpread.slice(dotIndex + 1);
	if (afterDot_string.length <= numberOfPlaces) {
		return String(myNum);
	}

	while (numSpread[0] == '0') {
		numSpread.shift();
	}
	numSpread = numbify(numSpread.slice(0, dotIndex + numberOfPlaces + 2));
	if (numSpread[numSpread.length - 1] == 0) {
		numSpread.pop();
		if (numSpread[numSpread.length - 1] == '.') {
			numSpread.pop();
		}
		return numSpread.join('');
	}

	let lastChar = numSpread[numSpread.length - 1];
	if (lastChar < 5) {
		numSpread.pop();
		while (numSpread[numSpread.length - 1] == 0) {
			numSpread.pop();
		}
		if (numSpread[numSpread.length - 1] == '.') {
			numSpread.pop();
		}
		return numSpread.join('');
	}

	numSpread.pop();
	if (numSpread[numSpread.length - 1] == '.') {
		numSpread.pop();
		numSpread[numSpread.length - 1] += 1;
		if (numSpread.length == 1 && numSpread[0] < 10) {
			return numSpread.join('');
		}
		let startLen = numSpread.length;
		while (numSpread[numSpread.length - 1] == 10 && numSpread.length > 1) {
			numSpread.pop();
			numSpread[numSpread.length - 1] += 1;
		}
		//if (numSpread[numSpread.length - 1] < 10) {numSpread[numSpread.length - 1] += 1;}
		let finalLen = numSpread.length;
		numSpread[numSpread.length - 1] =
			numSpread[numSpread.length - 1] * 10 ** (startLen - finalLen);
		return numSpread.join('');
	}

	numSpread[numSpread.length - 1] += 1;
	while (
		numSpread[numSpread.length - 1] == 10 &&
		numSpread[numSpread.length - 2] !== '.'
	) {
		numSpread.pop();
		numSpread[numSpread.length - 1] += 1;
	}

	if (numSpread[numSpread.length - 1] == 10) {
		numSpread = numSpread.slice(0, -2);
		numSpread[numSpread.length - 1] += 1;
		if (numSpread.length == 1 && numSpread[0] < 10) {
			return numSpread.join('');
		}
		let startLen = numSpread.length;
		while (numSpread[numSpread.length - 1] == 10 && numSpread.length > 1) {
			numSpread.pop();
			numSpread[numSpread.length - 1] += 1;
		}
		//if (numSpread[numSpread.length - 1] < 10) {numSpread[numSpread.length - 1] += 1;}
		let finalLen = numSpread.length;
		numSpread[numSpread.length - 1] =
			numSpread[numSpread.length - 1] * 10 ** (startLen - finalLen);
		return numSpread.join('');
	}

	return numSpread.join('');
}

/* round to precision if myNum greater than 100, between 10 and 100, between 1 and 10, less than 1 */
function round_bySize(myNum) {
	let precision = (() => {
		switch (true) {
			case myNum >= 200:
				return 0;
			case myNum < 200 && myNum >= 5:
				return 1;
			case myNum < 5:
				return 2;
		}
	})();

	let res = roundTo(myNum, precision);
	if (res.match(/\.0+$|\.$/gi) !== null) {
		while (res.charAt(res.length - 1) == '0') {
			res = res.slice(0, -1);
		}
		res = res.slice(0, -1);
	}

	return res;
}

/* ---- USER INPUT PARSER ---- */

/* input string, error check for numFlours > 0 || numAsterisks == 1, output array */
function firstPass(myString, subrIndex = undefined, isItemWeight = false) {
	const numSplit_gram = /\d(?=grams|gram|gr\.|gr|g\.|g(?=\s))/gi;
	const numSplit_ounce = /\d(?=ounces|ounce|oz\.|oz(?=\s))/gi;
	const numSplit_pound = /\d(?=pounds|pound|lbs\.|lbs|lb\.|lb|#)/gi;
	let numSplit_list = [numSplit_gram, numSplit_ounce, numSplit_pound];

	const gramFinder = /\sgrams|\sgram|\sgr\.|\sgr|\sg\.|\sg(?=\s)/gi;
	const ounceFinder = /\sounces|\sounce|\soz\.|\soz(?=\s)/gi;
	const poundFinder = /\spounds|\spound|\slbs\.|\slbs|\slb\.|\slb|\s#/gi;
	let finder_list = [gramFinder, ounceFinder, poundFinder];

	const multiSpaceFinder = /\s+/gi;

	function numSpacer(str, regexList) {
		for (let i = 0; i < regexList.length; i++) {
			str = str.replace(regexList[i], match => {
				return match + ' ';
			});
		}
		return str;
	}

	function contextReplacer(str, regexList) {
		for (let i = 0; i < regexList.length; i++) {
			str = str.replace(regexList[i], match => {
				switch (true) {
					case match.match(gramFinder) !== null:
						return ' g ';
					case match.match(ounceFinder) !== null:
						return ' oz ';
					case match.match(poundFinder) !== null:
						return ' # ';
					default:
						return match;
				}
			});
		}
		return str;
	}

	let s = numSpacer(myString, numSplit_list);
	s = contextReplacer(s, finder_list)
		.replace(multiSpaceFinder, ' ')
		.replace(/\,/gi, '');

	if (isItemWeight) {
		return s.split(' ').filter(val => {
			return val !== '';
		});
	}

	let warningDiv =
		subrIndex == undefined
			? document.getElementById('main-recipe-warning')
			: document.getElementById(`subr-recipe-warning-${subrIndex}`);
	let numFlours = 0,
		numAsterisks = 0;
	let arr = s.split(' ').filter(val => {
		return val !== '';
	});
	for (var i = 0; i < arr.length; i++) {
		if (arr[i].match(/flour/gi) !== null) {
			numFlours++;
		} else if (arr[i].match(/\*/gi) !== null) {
			numAsterisks++;
		}
	}
	let warning = (() => {
		switch (true) {
			case numAsterisks > 1:
				return 'Please select only one main ingredient with an asterisk!';
			case numAsterisks == 0 && numFlours == 0 && s !== '':
				return 'Please designate a main ingredient with an asterisk (*) or add "flour" to any flour ingredient, like "AP => AP flour..."';
			default:
				return '';
		}
	})();
	if (warning !== '') {
		warningDiv.innerText = warning;
		return;
	}
	return arr;
}

/* converts '1/2' to 0.5 */
function fracEval(myArray) {
	let fracRegex = /\d*\/\d*/g;
	return myArray
		.join(' ')
		.replace(fracRegex, str => {
			let splitFracArray = str.split('/');
			return splitFracArray[0] / splitFracArray[1];
		})
		.split(' ');
}

/* converts numbers, returns strings if NaN */
function numbify(myArray) {
	for (var i = 0; i < myArray.length; i++) {
		myArray[i] = isNaN(Number(myArray[i])) ? myArray[i] : Number(myArray[i]);
	}
	return myArray;
}

function sumConsec(myArray) {
	var res = [];
	while (myArray.length > 0) {
		typeof myArray[0] === 'number' && typeof myArray[1] === 'number'
			? (() => {
					res.push(myArray[0] + myArray[1]);
					myArray.splice(0, 2);
			  })()
			: res.push(myArray.shift());
	}
	return res;
}

function simplifyCompoundImperial(myArray) {
	let grOzRegex = /^g$|^oz$/gi;
	let poundRegex = /^\#$/gi;
	let sum;

	for (var i = 0; i < myArray.length; i++) {
		try {
			if (
				typeof myArray[i] === 'number' &&
				myArray[i + 1].match(poundRegex) !== null &&
				typeof myArray[i + 2] === 'number' &&
				myArray[i + 3].match(grOzRegex) !== null
			) {
				sum = myArray[i] * 16 + myArray[i + 2];
				myArray.splice(i, 3, sum);
			}
		} catch (e) {
			/* do nothing */
		}
	}
	return myArray;
}

/* isItemWeight defined true ONLY by calculateTDW() if itemWeight string */
function parseUserInput(myString, subrIndex, isItemWeight = false) {
	return simplifyCompoundImperial(
		sumConsec(numbify(fracEval(firstPass(myString, subrIndex, isItemWeight))))
	);
}

function validateUserInput(myArray, subrIndex) {
	const unitRegex = /^g$|^oz$|^\#$/gi;
	let warningDiv =
		subrIndex == undefined
			? document.getElementById('main-recipe-warning')
			: document.getElementById(`subr-recipe-warning-${subrIndex}`);
	let carr = clone(myArray);

	if (typeof carr[0] !== 'number') {
		warningDiv.innerText =
			'Oops! Please make sure your recipe begins with a number.';
		return;
	}

	let temp = [],
		res = [],
		ingname = [],
		unitCounter = 0;
	while (carr.length > 0) {
		temp.push(carr.shift());
		carr[0].match(unitRegex) == null
			? (() => {
					temp.push('no_unit');
					unitCounter++;
			  })() /* no_unit preserves subArray length for unitConvert() */
			: temp.push(carr.shift());
		if (typeof carr[0] === 'number') {
			temp.push('name_error');
			res.push(temp);
			temp = [];
			continue;
		}
		while (typeof carr[0] === 'string') {
			ingname.push(carr.shift());
		}
		temp.push(ingname.join(' '));
		res.push(temp.flat());
		temp = [];
		ingname = [];
	}

	let str = res.flat().join(' ');
	if (str.match(/name_error/gi) !== null) {
		for (let i = 0; i < res.length; i++) {
			if (res[i][2].match(/name_error/gi) == null) {
				continue;
			}
			warningDiv.innerText = `Oops! Please add an ingredient name to "${res[i][0]} ${res[i][1]} __".`;
			return;
		}
	}

	let isUniform = unitCounter == res.length;
	if (!isUniform) {
		for (let i = 0; i < res.length; i++) {
			if (res[i][1].match(/no_unit/gi) == null) {
				continue;
			}
			warningDiv.innerText = `Oops! Please add a unit to "${res[i][0]} __ ${res[i][2]}".`;
			return;
		}
	}

	return res;
}

/* convert imperial weights */
function unitConvert(myArray) {
	for (var i = 0; i < myArray.length; i++) {
		if (myArray[i][1] == 'oz') {
			let conv = myArray[i][0] * 28.3495; // 1 oz = 28.3495 g
			myArray[i].splice(0, 1, conv);
			myArray[i].splice(1, 1, 'g');
		} else if (myArray[i][1].match(/lbs|lb|\#/gi) !== null) {
			let conv = myArray[i][0] * 16 * 28.3495; // 1 # (lb) = 16 oz, 1 oz = 28.3495 g
			myArray[i].splice(0, 1, conv);
			myArray[i].splice(1, 1, 'g');
		}
	}
	return myArray;
}

/* take user input from textarea and return 2d-array [[100, 'g', 'ap flour'], ...] */
function get_parsedInput(subrIndex = undefined) {
	let myString =
		subrIndex == undefined
			? document.getElementById('main-recipe-textarea').innerText
			: document.getElementById(`subr-recipe-textarea-${subrIndex}`).innerText;
	let parsedInput = unitConvert(
		validateUserInput(parseUserInput(myString, subrIndex), subrIndex)
	);
	return parsedInput;
}

/* ---- BAKER'S MATH ---- */

/* add total main weight row or move asterisked-tmw to top of array */
function get_tmwArray(myArray) {
	const asteriskFinder = /\*/gi;
	const flourFinder = /flour/gi;
	let flourSum = 0,
		asterisk_loc,
		isAsterisk = false;

	for (var i = 0; i < myArray.length; i++) {
		if (myArray[i][2].match(flourFinder) !== null) {
			flourSum += myArray[i][0];
		}
		if (myArray[i][2].match(asteriskFinder) !== null) {
			asterisk_loc = i;
			isAsterisk = true;
		}
	}
	if (isAsterisk) {
		myArray.unshift(myArray.splice(asterisk_loc, 1).flat());
		return myArray;
	}
	myArray.unshift([flourSum, 'fs-unit', 'total flour']);
	return myArray;
}

/* takes input from get_tmwArray() output,
returns array structured: [totalFormula, [array of ingredient baker's percentages...]] */
function get_bpArray(tmwArray) {
	let temp = [],
		res = [];
	for (let i = 0; i < tmwArray.length; i++) {
		temp.push((tmwArray[i][0] / tmwArray[0][0]) * 100);
	}
	let cTemp = clone(temp);
	res.push(temp);

	/* drop the tmw value before getting totalFormula */
	cTemp.shift();
	let mainIngredientFormula = cTemp.reduce((a, b) => a + b, 0);
	res.unshift(mainIngredientFormula);
	return res;
}

/* helper restores original user input to main/subr textarea after get_ingNameAndBPArray() call */
function restore_originalInputString(subrIndex = undefined) {
	let textarea_selector =
		subrIndex == undefined
			? '#main-recipe-textarea'
			: `subr-recipe-textarea-${subrIndex}`;
	if (original_inputString !== undefined) {
		document.querySelector(textarea_selector).innerText = original_inputString;
	}
}

/* return array structured [['total flour', '100'], ['bread flour', '50']...] */
function get_ingNameAndBPArray(subrIndex = undefined) {
	/* !important: clear warningDiv for checks from calculateTDW(), updaters (after table has been created) */
	let mainOrSubr_warningDiv =
		subrIndex == undefined
			? 'main-recipe-warning'
			: `subr-recipe-warning-${subrIndex}`;
	document.getElementById(mainOrSubr_warningDiv).innerText = '';

	let tmw_arr = get_tmwArray(get_parsedInput(subrIndex));
	let bp_arr = get_bpArray(tmw_arr)[1];

	let res = [];
	for (var i = 0; i < bp_arr.length; i++) {
		/* important! prevents mismatch of flourSum in exitVal comparison by focusoutHandler */
		let bpVal =
			tmw_arr[i][2].match(/flour/gi) == null
				? round_bySize(bp_arr[i])
				: roundTo(bp_arr[i], 2);
		res.push([tmw_arr[i][2], String(bpVal)]);
	}

	/* check that flourSum == 100 and adjust largest flourBP if necessary */
	function adjust_flourSum(ingNameAndBPArray) {
		let is_asteriskNode = clone(ingNameAndBPArray)
			.map(subarr => subarr[0])
			.some(val => val.match(/\*/gi) !== null);
		if (is_asteriskNode) {
			return ingNameAndBPArray;
		}

		/* match only 'flour' not preceded by 'total ' */
		let flourRows = ingNameAndBPArray.filter(row => {
			return (
				row[0].match(/flour/gi) !== null && row[0].match(/total/gi) == null
			);
		});
		if (flourRows.length == 0) {
			return ingNameAndBPArray;
		}

		let flourValArray = (() => {
			let res = [];
			for (let i = 0; i < flourRows.length; i++) {
				res.push(Number(flourRows[i][1]));
			}
			return res;
		})();
		let flourSum = Number(
			roundTo(
				flourValArray.reduce((a, b) => a + b, 0),
				2
			)
		);
		if (flourSum == 100) {
			ingNameAndBPArray.forEach(subarr => {
				subarr[1] = round_bySize(subarr[1]);
			});
			return ingNameAndBPArray;
		}

		let bp_diff = Number(roundTo(100 - flourSum, 2));
		let largest_flourBP = flourValArray.sort()[flourValArray.length - 1];

		for (var i = 0; i < ingNameAndBPArray.length; i++) {
			if (ingNameAndBPArray[i][1] == largest_flourBP) {
				ingNameAndBPArray[i][1] = roundTo(largest_flourBP + bp_diff, 3);
				break;
			}
		}

		return ingNameAndBPArray;
	}

	restore_originalInputString(subrIndex);
	return adjust_flourSum(res);
}

/* return tf_val (numString) */
function get_totalFormulaVal(ingNameAndBPArray) {
	let bpValArray = (() => {
		let res = [];
		ingNameAndBPArray.forEach(s_arr => {
			if (s_arr[0] !== 'total flour') {
				res.push(Number(s_arr[1]));
			}
		});
		return res;
	})();
	let totalFormula = bpValArray.reduce((a, b) => a + b, 0);
	return roundTo(totalFormula, 3);
}
