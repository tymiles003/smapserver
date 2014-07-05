/*
This file is part of SMAP.

SMAP is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

SMAP is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with SMAP.  If not, see <http://www.gnu.org/licenses/>.

*/

var	gProjectList,
	gLanguages,
	gCurrentProject = 0,
	gCurrentSurvey = 0,
	gLoggedInUser,
	gEditingReportProject,   		// Set if fieldAnalysis called to edit a report
	gWait = 0,						// Counter set non zero when there are long running processes running
	gIsAdministrator = false;
	gIsOrgAdministrator = false;
	
// Global Model Object
var gSelector = new Selector();

/*
 * ===============================================================
 * Project Functions
 * ===============================================================
 */

/*
 * Update the list of available projects
 */
function updateProjectList(addAll, projectId, callback) {

	var $projectSelect = $('.project_list'),
		i, 
		h = [],
		idx = -1,
		updateCurrentProject = true;
	
	if(addAll) {
		h[++idx] = '<option value="0">All</option>';
		updateCurrentProject = false;
	}
	for(i = 0; i < gProjectList.length; i++) {
		h[++idx] = '<option value="';
		h[++idx] = gProjectList[i].id;
		h[++idx] = '">';
		h[++idx] = gProjectList[i].name;
		h[++idx] = '</option>';
		
		if(gProjectList[i].id === projectId) {
			updateCurrentProject = false;
		}
	}
	$projectSelect.empty().append(h.join(''));

	// If for some reason the user's default project is no longer available then 
	//  set the default project to the first project in the list
	//  if the list is empty then set the default project to undefined
	if(updateCurrentProject && gProjectList[0]) {	
		gCurrentProject = gProjectList[0].id;		// Update the current project id
		saveCurrentProject(gCurrentProject);	// Save the current project id
	} else if(updateCurrentProject) {	
		gCurrentProject = -1;		// Update the current project id
		saveCurrentProject(gCurrentProject);	// Save the current project id
	}
	
	$projectSelect.val(gCurrentProject);			// Set the initial project value
	$('#projectId').val(gCurrentProject);			// Set the project value for the hidden field in template upload

	if(typeof callback !== "undefined") {
		callback(gCurrentProject);				// Call the callback with the correct current project
	}
}

/*
 * Get the list of available projects from the server
 */
function getMyProjects(projectId, callback, getAll) {
	addHourglass();
	$.ajax({
		url: "/surveyKPI/myProjectList",
		dataType: 'json',
		cache: false,
		success: function(data) {
			removeHourglass();
			gProjectList = data;
			updateProjectList(getAll, projectId, callback);
		},
		error: function(xhr, textStatus, err) {
			removeHourglass();
			if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				alert("Error: Failed to get list of projects: " + err);
			}
		}
	});	
}

/*
 * Save the current project id in the user defaults
 */
function saveCurrentProject(projectId) {

	var user = {current_project_id: projectId};
	var userString = JSON.stringify(user);
	
	addHourglass();
	$.ajax({
		  type: "POST",
		  contentType: "application/json",
		  dataType: "json",
		  url: "/surveyKPI/user",
		  data: { user: userString },
		  success: function(data, status) {
			  removeHourglass();
		  }, error: function(data, status) {
			  removeHourglass();
			  console.log("Error: Failed to save current project");
		  }
	});
}


/*
 * ===============================================================
 * User Functions
 * ===============================================================
 */

/*
 * Update the user details on the page
 */
function updateUserDetails(data, getOrganisationsFn) {
	
	var groups = data.groups,
		i;
	
	gLoggedInUser = data;
	$('#username').html(data.name).button({ label: data.name + " @" + data.organisation_name, 
			icons: { primary: "ui-icon-person" }}).off().click(function(){
		$('#me_edit_form')[0].reset();
		
		$('#reset_me_password_fields').show();
		$('#password_me_fields').hide();
		$('#me_name').val(data.name);
		$('#me_email').val(data.email);
		
		$('#modify_me_popup').dialog("open");
	});
	
	/*
	 * Show administrator only functions
	 */
	if(groups) {
		for(i = 0; i < groups.length; i++) {
			if(groups[i].name === "admin") {
				gIsAdministrator = true;
			}
			if(groups[i].name === "org admin") {
				gIsOrgAdministrator = true;
			}
		}
	}
	if(gIsAdministrator) {
		$('.super_user_only').show();
	} else {
		$('.super_user_only').hide();
	}
	if(gIsOrgAdministrator) {
		$('.org_user_only').show();
		if(typeof getOrganisationsFn === "function") {
			getOrganisationsFn();
		}
	} else {
		$('.org_user_only').hide();
	}
}

/*
 * Enable the user profile button
 */
function enableUserProfile () {
	 // Initialse the dialog for the user to edit their own account details
	 $('#modify_me_popup').dialog(
		{
			autoOpen: false, closeOnEscape:true, draggable:true, modal:true,
			title:"Profile",
			show:"drop",
			width:350,
			height:350,
			zIndex: 2000,
			buttons: [
		        {
		        	text: "Cancel",
		        	click: function() {
		        		
		        		$(this).dialog("close");
		        	}
		        }, {
		        	text: "Save",
		        	click: function() {

		        		var user = gLoggedInUser,
		        			userList = [],
		        			error = false,
		        			userList;
		        		
		        		user.name = $('#me_name').val();
		        		user.email = $('#me_email').val();
		        		if($('#me_password').is(':visible')) {
		        			user.password = $('#me_password').val();
		        			if($('#me_password_confirm').val() !== user.password) {
		        				error = true;
		        				user.password = undefined;
		        				alert("Passwords do not match");
		        				$('#me_password').focus();
		        				return false;
		        			}
		        		} else {
		        			user.password = undefined;
		        		}
		        		
		        		user.current_project_id = 0;	// Tell service to ignore project id and update other details
		        		saveCurrentUser(user);			// Save the updated user details to disk
		        		$(this).dialog("close");
		        	}, 
		        }, {
		        	text: "Logout",
		        	click: function() {
		        		jQuery.ajax({
		        		    type: "GET",
		        			cache: false,
		        		    url: "/fieldManager/templateManagement.html",
		        		    username: "shkdhasfkhd",
		        		    password: "sieinkdnfkdf",
		        		    error: function(data, status) {
		        				  window.location.href="/";
		        			},
		        			success: function(data,status) {
		        				window.location.href="/";
		        			}
		        		});
		        		$(this).dialog("close");
		        	}
		        }
			]
		}
	 );
	 

	 // Initialise the reset password checkbox
	 $('#reset_me_password').click(function () {
		 if($(this).is(':checked')) {
			 $('#password_me_fields').show();
		 } else {
			 $('#password_me_fields').hide();
		 }
	 });
}

/*
 * Save the currently logged on user's details
 */
function saveCurrentUser(user) {

	var userString = JSON.stringify(user);
	addHourglass();
	$.ajax({
		  type: "POST",
		  contentType: "application/json",
		  dataType: "json",
		  url: "/surveyKPI/user",
		  data: { user: userString },
		  success: function(data, status) {
			  removeHourglass();
			  updateUserDetails(user, undefined);
			  alert("Profile Updated"); 
		  }, error: function(data, status) {
			  removeHourglass();
			  alert("Error profile not saved"); 
		  }
	});
}


function getLoggedInUser(callback, getAll, getProjects, getOrganisationsFn) {
	addHourglass();
	$.ajax({
		url: "/surveyKPI/user",
		cache: false,
		dataType: 'json',
		success: function(data) {
			removeHourglass();
			updateUserDetails(data, getOrganisationsFn);
			
			gEmailEnabled = data.allow_email;
			gFacebookEnabled = data.allow_facebook;
			gTwitterEnabled = data.allow_twitter;
			
			if(getProjects) {
				gCurrentProject = data.current_project_id;
				$('#projectId').val(gCurrentProject);		// Set the project value for the hidden field in template upload
				getMyProjects(gCurrentProject, callback, getAll);	// Get projects and call getSurveys when the current project is known
			}
			if(typeof enableFacebookDialog == 'function' && gFacebookEnabled) {
				enableFacebookDialog();
			}
		},
		error: function(xhr, textStatus, err) {
			removeHourglass();
			if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				console.log("Error: Failed to get user details: " + err);
				alert("Error: Failed to get user details: " + err);
			}
		}
	});	
}

/*
 * ===============================================================
 * Hourglass Functions
 * ===============================================================
 */

function addHourglass() {

	if(gWait === 0) {

		$("#hour_glass").show();
	}
	++gWait;
}

function removeHourglass() {

	--gWait;
	if(gWait === 0) {

		$("#hour_glass").hide();
	}

}

/*
 * ===============================================================
 * Survey Functions
 * ===============================================================
 */

/*
 * Load the surveys from the server
 */
function loadSurveys(projectId, selector, getDeleted, addAll, callback) {
	
	if(typeof projectId !== "undefined" && projectId != -1 && projectId != 0) {
		if(selector === undefined) {
			selector = ".survey_select";	// Update the entire class of survey select controls
		}
	
		var url="/surveyKPI/surveys?projectId=" + projectId + "&blocked=true",
			$elem = $(selector);
		
		if(getDeleted) {
			url+="&deleted=true";
		}
		addHourglass();

		$.ajax({
			url: url,
			dataType: 'json',
			cache: false,
			success: function(data) {
				
				removeHourglass();
				gSurveys = data;
				$elem.empty();
				if(addAll) {
					$elem.append('<option value="_all">All Surveys</option>');	
				}
				$.each(data, function(j, item) {
					$elem.append('<option value="' + item.id + '">' + item.displayName + '</option>');
				});

				gCurrentSurvey = $elem.val();
				
				if(typeof callback == "function") {
					callback();
				}
			},
			error: function(xhr, textStatus, err) {
				
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					console.log("Error: Failed to get list of surveys: " + err);
				}
			}
		});	
	} else {
		$elem.empty();
		if(addAll) {
			$elem.append('<option value="_all">All Surveys</option>');	
		}
		
		if(callback) {
			callback();
		}

	}
}

// Common Function to get the language and question list (for the default language)
function getLanguageList(sId, callback, addNone, selector, setGroupList) {
	
	if(typeof sId === "undefined") {
		sId = gCurrentSurvey;
	}
	
	function getAsyncLanguageList(sId, theCallback, selector) {
		addHourglass();
		$.ajax({
			url: languageListUrl(sId),
			dataType: 'json',
			cache: false,
			success: function(data) {
				removeHourglass();
				gSelector.setSurveyLanguages(sId, data);
				if(selector) {
					setSurveyViewLanguages(data, undefined, selector, addNone);
				} else {
					setSurveyViewLanguages(data, undefined, '#settings_language', false);	
					setSurveyViewLanguages(data, undefined, '#export_language', true);
					setSurveyViewLanguages(data, undefined, '#language_name', false);
				}
				
				if(data[0]) {
					getQuestionList(sId, data[0].name, "-1", "-1", theCallback, setGroupList, undefined);	// Default language to the first in the list
				} else {
					theCallback();
				}
				
			},
			error: function(xhr, textStatus, err) {
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					alert("Error: Failed to get list of languages: " + err);
				}
			}
		});	
	}
	
	getAsyncLanguageList(sId, callback, selector);
}

//Function to get the question list
function getQuestionList(sId, language, qId, groupId, callback, setGroupList, view) {

	function getAsyncQuestionList(sId, language, theCallback, groupId, qId, view) {
	
		addHourglass();
		$.ajax({
			url: questionListUrl(sId, language, true),
			dataType: 'json',
			cache: false,
			success: function(data) {
				removeHourglass();
				gSelector.setSurveyQuestions(sId, language, data);
				setSurveyViewQuestions(data, qId, view);
	
				if(setGroupList && typeof setSurveyViewQuestionGroups === "function") {
					setSurveyViewQuestionGroups(data, groupId);
				}
				if(typeof theCallback === "function") {
					theCallback();
				}
			},
			error: function(xhr, textStatus, err) {
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					alert("Error: Failed to get list of questions: " + err);
				}
			}
		});	
	}
	
	getAsyncQuestionList(sId, language, callback, groupId, qId, view);
}

//Set the language list in the survey view control
function setSurveyViewLanguages(list, language,elem, addNone) {

	var $languageSelect = $(elem);
	$languageSelect.empty();
	if(addNone) {
		$languageSelect.append('<option value="none">None</option>');
	}
	$.each(list, function(j, item) {
		$languageSelect.append('<option value="' + item.name + '">' + item.name + '</option>');
	});
	if(language) {
		$languageSelect.val(language);
	}
}

// Set the question list in the survey view control
function setSurveyViewQuestions(list, qId, view) {
	
	var $questionSelect = $('.selected_question'),
		label;
	
	$questionSelect.empty();
	$questionSelect.append('<option value="-1">None</option>');

	if(list) {
		$.each(list, function(j, item) {
			if(typeof item.q === "undefined") {
				label = "";
			} else {
				label = item.q;
			}
			if(item.is_ssc) {
				$questionSelect.append('<option value="' + item.id + '">ssc : ' + item.name + " : " + item.fn + '</option>');
			} else {
				$questionSelect.append('<option value="' + item.id + '">' + item.name + " : " + label + '</option>');
			}
		});
	}
	if(!qId) {
		qId = "-1";
	}
	$questionSelect.val(qId);
	if(view) {
		setFilterFromView(view);	// Set the filter dialog settings
	}

}

/*
 * ------------------------------------------------------------
 * Web service Functions
 */
function languageListUrl (sId) {

	var url = "/surveyKPI/languages/";
	url += sId;
	return url;
}

/*
 * Web service handler for retrieving available "count" questions for graph
 *  @param {string} survey
 */
function questionListUrl (sId, language, exc_read_only) {

	var url = "/surveyKPI/questionList/", 
		ro_text;
	
	if(exc_read_only) {
		ro_text = "true";
	} else {
		ro_text = "false";
	}
	
	url += sId;
	url += "/" + language;
	url += "?exc_read_only=" + ro_text;
	return url;
}

/**
 * Web service handler for question Meta Data
 * @param {string} survey id
 * @param {string} question id
 */
function questionMetaURL (sId, lang, qId) {

	var url = "/surveyKPI/question/";
	url += sId;
	url += "/" + lang;
	url += "/" + qId;
	url += "/getMeta";
	return url;
}

function Selector() {
	
	this.dataItems = new Object();
	//this.panelDataItems = new Object();
	this.surveys = new Object();
	this.surveyLanguages = new Object();
	this.surveyQuestions = new Object();
	this.questions = new Object();
	this.allSurveys;				// Simple list of surveys
	this.allRegions;
	this.views = [];			// Simple list of views
	this.maps = {};				// map panels indexed by the panel id
	this.changed = false;
	this.SURVEY_KEY_PREFIX = "surveys";
	this.TASK_KEY = "tasks";
	this.TASK_COLOR = "#dd00aa";
	this.SURVEY_COLOR = "#00aa00";
	this.SELECTED_COLOR = "#0000aa";
	this.currentPanel = "map";
	
	/*
	 * Get Functions
	 */
	this.getAll = function () {
		return this.dataItems;
	};
	
	this.getItem = function (key) {
		return this.dataItems[key];
	};
	
	// Return all the table data available for a survey
	this.getFormItems = function (sId) {
		var tableItems = new Object();
		for(var key in this.dataItems) {
			var item = this.dataItems[key];
			if(item.table == true && item.sId == sId) {
				tableItems[key] = item;
			}
		}
		return tableItems;
	};
	
	this.getSurvey = function (key) {
		return this.surveys[key];
	};
	
	this.getSurveyQuestions = function (sId, language) {
		var langQ = this.surveyQuestions[sId];
		if(langQ) {
			return langQ[language];
		} else {
			return null;
		}
	};
	
	this.getSurveyLanguages = function (key) {
		return this.surveyLanguages[key];
	};
	
	// Returns the list of surveys on the home server
	this.getSurveyList = function () {
		return this.allSurveys;
	};
	
	this.getRegionList = function () {
		return this.allRegions;
	};
	
	// deprecate question meta should be replaced by all question details in the question list
	this.getQuestion = function(qId, language) {
		var langQ = this.questions[qId];
		if(langQ) {
			return langQ[language];
		} else {
			return null;
		}
	};
	
	/*
	 * Get the question details that came with the question list
	 * This aproach should replace the concept of "question meta"
	 */
	this.getQuestionDetails = function(sId, qId, language) {
		var qList = this.getSurveyQuestions(sId, language),
			i;
		
		for(i = 0; i < qList.length; i++) {
			if(qList[i].id == qId) {
				return qList[i];
			}
		}
		return null;
	};
	
	this.hasQuestion = function(key) {
		if(this.questions[key] != undefined) {
			return true;
		} else {
			return false;
		}
	};
	
	// Return the list of current views
	this.getViews = function () {
		return this.views;
	};
	
	// Return a map if it exists
	this.getMap = function (key) {
		return this.maps[key];
	};
	
	
	/*
	 * Set Functions
	 */
	this.addDataItem = function (key, value) {
		this.dataItems[key] = value;
		this.changed = true;
	};	
	
	this.clearDataItems = function () {
		this.dataItems = new Object();
	};	
	
	this.clearSurveys = function () {
		this.surveys = new Object();
		this.surveyLanguages = new Object();
		this.surveyQuestions = new Object();
		this.questions = new Object();
		this.allSurveys = undefined;				
		this.allRegions = undefined;
	};	
	
	this.setSurveyList = function (list) {
		this.allSurveys = list;
		if(typeof list[0] !== "undefined") {
			this.selectedSurvey = list[0].sId;
		}
	};	
	
	this.setSurveyLanguages = function (key, value) {
		this.surveyLanguages[key] = value;
	};
	
	this.setSurveyQuestions = function (sId, language, value) {
		var langQ = new Object();
		langQ[language] = value;
		this.surveyQuestions[sId] = langQ;
	};
	
	this.setRegionList = function (list) {
		this.allRegions = list;
	};	
	
	this.addSurvey = function (key, value) {
		this.surveys[key] = value;
	};
	
	this.setSelectedSurvey = function (survey) {
		this.selectedSurvey = survey;
	};
	
	this.setSelectedQuestion = function (id) {
		this.selectedQuestion = id;
	};
	
	this.addQuestion = function (qId, language, value) {	
		var langQ = this.questions[qId];
		if(!langQ) {
			this.questions[qId] = new Object();
			langQ = this.questions[qId];
		}
		langQ[language] = value;
	};	
	
	// Set the list of views to the passed in array
	this.setViews = function (list) {
		this.views = list;
	};	
	
	// Set the passed in map into the maps object indexed by key
	this.setMap = function (key, value) {
		this.maps[key] = value;
	};
	
}

/*
 * Show any errors during uploading of a page
 */
function showErrors() {
	var m = window.location.search;

	console.log("show errors:" + m);
	if (m.length > 0) {
		var keys = m.split("&");
		for(i = 0; i < keys.length; i++) {
			console.log("keys[" + i + "] " + keys[i])
			var param = keys[i].split("=");
			console.log("param[0]" + param[0]);
			if (param[0] === "?mesg" || param[0] === "mesg") {
				alert(unescape(param[1]));
			}
		}
	}
}

/*
 * Add an alias for language translation
 */
var l = function (string) {
    return string.toLocaleString();
};
