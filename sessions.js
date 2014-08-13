//TODO: listview, offline, IE bummer, favorites, amplify caching, gravatar, google analytics

function jsonStringToDate(strDate)
{
    /// <param name="strDate" type="String"></param>
    //Format "/Date(1364817449533)/"
    var strDate = strDate.replace(/\/Date\(([0-9]+)\)\//, "$1");
    return new Date(parseInt(strDate, 10));
}

$(function ()
{
    $(".about a").attr("target", "_blank");
	
	ko.bindingHandlers.collapse = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext)
        {
            $(element).attr({ "data-toggle": "collapse", "data-target": valueAccessor() });
            setTimeout(function () { $(element).collapse({ toggle: false }); }, 0);
        }
    };

    var viewModel = {
        sessionsByDay: ko.observableArray([]),
        search: ko.observable(''),
        onlyFavorites: ko.observable(false),
        showMap: ko.observable(false),
		showOld: ko.observable(false),
		showAbout: ko.observable(false),
        doNothing: function ()
        {
            //Bwahahahahaha
        }
    };
	
	viewModel.toggleShowOld = function ()
    {
        this.showOld(!this.showOld());
    }.bind(viewModel);

    viewModel.toggleOnlyFavorites = function ()
    {
        this.onlyFavorites(!this.onlyFavorites());
    }.bind(viewModel);

    viewModel.toggleMap = function ()
    {
        this.showMap(!this.showMap());
    }.bind(viewModel);
	
	viewModel.toggleShowAbout = function ()
    {
        this.showAbout(!this.showAbout());
    }.bind(viewModel);

    viewModel.toggleFavorite = function (session)
    {
        session.isFavorite(!session.isFavorite());
    };

    viewModel.sessions = ko.computed(function() {
        var flatDays = _.flatten(viewModel.sessionsByDay(), "TimeSlots");
        var flatSessions = _.flatten(flatDays, "Sessions");
        return flatSessions;
    });

    viewModel.delayedSearch = ko.computed(viewModel.search).extend({ throttle: 250 });

    viewModel.days = ko.computed(function viewModel$days()
    {
        var days = ko.utils.arrayFilter(this.sessionsByDay(),
            function (day)
            {
                return this.showOld() || day.Day >= Date.create("today");
            }.bind(this));
        if (days.length)
        {
            var selectedDateValue = amplify.store("selectedDateValue");
            var selectedDay;
            if (selectedDateValue)
            {
                selectedDay = ko.utils.arrayFirst(days, function (day) { return day.Day.valueOf() === selectedDateValue; });
            }
            if (selectedDay)
            {
                selectedDay.selected(true);
            }
            else
            {
                days[0].selected(true); //Select the first day by default
            }
        }
        return days;
    }, viewModel);

    viewModel.selectedDay = ko.computed(function ()
    {
        return ko.utils.arrayFirst(this.sessionsByDay(), function (day) { 
            return day.selected();
        });
    }, viewModel);

    //viewModel.categories = ko.computed(function viewModel$categories()
    //{
    //    var categories = [];
    //    ko.utils.arrayForEach(this.sessions(), function (session)
    //    {
    //        var category = ko.utils.arrayFirst(categories, function (cat) { return cat.name === session.Category });
    //        if (!category)
    //        {
    //            categories.push({ name: session.Category, count: 1, selected: ko.observable(true) });
    //        }
    //        else
    //        {
    //            category.count++;
    //        }
    //    });
    //    return categories;
    //}, viewModel);

    //viewModel.selectedCategories = ko.computed(function viewModel$selectedCategories()
    //{
    //    return ko.utils.arrayFilter(this.categories(), function (category)
    //    {
    //        return category.selected();
    //    });
    //}, viewModel);

    //viewModel.allCategoriesSelected = ko.computed(function ()
    //{
    //    return !ko.utils.arrayFirst(this.categories(), function (category) { return !category.selected(); });
    //}, viewModel);

    viewModel.selectedSessions = ko.computed(function viewModel$selectedSessions()
    {
        //var selectedCategories = ko.utils.arrayMap(this.selectedCategories(), function (category) { return category.name; });
        var selectedDay = this.selectedDay();
        var search = this.delayedSearch().toLowerCase();
        var selectedSessions = ko.utils.arrayFilter(this.sessions(), function (session)
        {
            var searchResult = true;
            if (search)
            {
                searchResult = false;
                searchResult = (session.Title.toLowerCase().indexOf(search) > -1) || (session.Description.toLowerCase().indexOf(search) > -1);
                searchResult = searchResult || !!ko.utils.arrayFirst(session.Speakers, function (person)
                {
                    return (person.FirstName.toLowerCase().indexOf(search) > -1) || (person.LastName.toLowerCase().indexOf(search) > -1);
                });
            }
            var dateResult = selectedDay && session.ScheduledDateTime.clone().beginningOfDay().valueOf() === selectedDay.Day.valueOf();
			var timeResult = this.showOld() || session.ScheduledDateTime.clone().addHours(1).isFuture();
            var favoritesResult = !this.onlyFavorites() || session.isFavorite();
            //return ((selectedCategories.indexOf(session.Category) > -1) && searchResult);
            return (session.Accepted && dateResult && searchResult && favoritesResult && timeResult);
        }.bind(this));
        return selectedSessions.sortBy(function (session) { return session.ScheduledDateTime.valueOf() + parseInt(session.Level,10); });
    }, viewModel);

    viewModel.toggleSelected = function toggleSelected(clickedDay)
    {
        if (!clickedDay.selected())
        {
            clickedDay.selected(true);
            ko.utils.arrayForEach(this.sessionsByDay(),
                function (day)
                {
                    if (day.Day.valueOf() !== clickedDay.Day.valueOf())
                    {
                        day.selected(false);
                    }
                });
        }
    }.bind(viewModel);

    ko.applyBindings(viewModel);

    amplify.request.define("sessions", "ajax", { url: "https://www.thatconference.com/api3/Session/GetAcceptedSessionsByTimeslot" });
    
    amplify.request("sessions", function (data)
    {
        //data.ScheduledSessions[]
            // Day = "Sat 8/9"
            // TimeSlots[]
                // Time = "8:30 AM"
                // Sessions[]
                    // Accepted: true
                    // Canceled: false
                    // Category: "That Conference"
                    // Description: "On August 9th and 10th, That Conference will host the 2014 Midwest GiveCamp. This year, Midwest Midwest GiveCamp and That Conference will team up with the Humanitarian Toolbox in a quest to help build software in support of disaster relief. This is a free event for all paid attendees and food will be provided."
                    // Id: 5468
                    // IsFamilyApproved: false
                    // IsUserFavorite: null
                    // LastUpdated: "2014-08-08T11:26:21.693"
                    // Level: "100"
                    // ScheduledDateTime: Sat Aug 09 2014 08:30:00 GMT-0500 (Central Daylight Time)
                    // ScheduledRoom: "Cypress"
                    // SessionLinks: Array[0]
                    // ShowMoreDetails: false
                    // Speakers: Array[1]
                        // 0: Object
                        // Biography: "The best developer conference!"
                        // Company: null
                        // Facebook: null
                        // FirstName: "That"
                        // GitHub: null
                        // GooglePlus: null
                        // HeadShot: "/cloud/profilephotos/That-Conference-b09e7430-5905-418e-b775-fb08f8e814c8-635349489932052255.png"
                        // LastName: "Conference"
                        // LastUpdated: "2014-05-14T14:24:22.567"
                        // LinkedIn: null
                        // Title: null
                        // Twitter: "@ThatConference"
                        // UserName: "TCAdmin"
                        // WebSite: "http://www.thatconference.com"
                        // __proto__: Object
                        // length: 1
                        // __proto__: Array[0]
                    // Tags: Array[2]
                    // Title: "GiveCamp and The Humanitarian Toolbox"
                    // Updated: true

        var favoriteSessionIDs = amplify.store("favoriteSessionIDs");
        for (var i = 0; i < data.ScheduledSessions.length; i++)
        {
            var sessionsByDay = data.ScheduledSessions[i];
            sessionsByDay.selected = ko.observable(false);
            var dateString = sessionsByDay.Day.split(" ")[1];
            sessionsByDay.Day = Date.create(dateString);
            for (var j = 0; j < sessionsByDay.TimeSlots.length; j++) {
                var sessionsByTimeslot = sessionsByDay.TimeSlots[j];
                for (var k = 0; k < sessionsByTimeslot.Sessions.length; k++) {
                    var session = sessionsByTimeslot.Sessions[k];
                    var dateTimeString = dateString + " " + sessionsByTimeslot.Time;
                    session.ScheduledDateTime = Date.create(dateTimeString);
                    session.isFavorite = ko.observable(favoriteSessionIDs && (favoriteSessionIDs.indexOf(session.Id) > -1));
                };
            };
        };

        viewModel.sessionsByDay(data.ScheduledSessions);

        var futureSessions = ko.utils.arrayFilter(viewModel.sessions(), function(session) 
            {
                return session.ScheduledDateTime.clone().addHours(1).isFuture();
            });
        if (!futureSessions.length)
        {
            viewModel.showOld(true);
        }

        viewModel.favoriteSessionIDs = ko.computed(function ()
        {
            var favSessions = ko.utils.arrayFilter(this.sessions(), function (session) { return session.isFavorite(); });
            var favSessionIDs = ko.utils.arrayMap(favSessions, function (session) { return session.Id; });
            return favSessionIDs;
        }, viewModel);

        viewModel.favoriteSessionIDs.subscribe(function (newValue)
        {
            amplify.store("favoriteSessionIDs", newValue);
        });

        viewModel.selectedDay.subscribe(function (newValue)
        {
            if (newValue)
			{
				amplify.store("selectedDateValue", newValue.Day.valueOf());
			}
        });

    });
});