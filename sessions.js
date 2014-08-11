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
        sessions: ko.observableArray([]),
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

    viewModel.delayedSearch = ko.computed(viewModel.search).extend({ throttle: 250 });

    viewModel.days = ko.computed(function viewModel$days()
    {
        var days = ko.utils.arrayGetDistinctValues(ko.utils.arrayMap(this.sessions(),
            function (session)
            {
                var sessionDateTime = session.ScheduledDateTime.clone();
                if (this.showOld() || sessionDateTime.clone().addHours(1).isFuture())
                {
                    return sessionDateTime.beginningOfDay().getTime();
                }
            }.bind(this)));
        days.sort();
        days = ko.utils.arrayFilter(days, function (day) { return day; });
        days = ko.utils.arrayMap(days,
            function (day)
            {
                return { date: Date.create(day), selected: ko.observable(false) };
            });
        if (days.length)
        {
            var selectedDateValue = amplify.store("selectedDateValue");
            var selectedDay;
            if (selectedDateValue)
            {
                selectedDay = ko.utils.arrayFirst(days, function (day) { return day.date.valueOf() === selectedDateValue; });
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
        return ko.utils.arrayFirst(this.days(), function (day) { return day.selected(); });
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
                searchResult = searchResult || !!ko.utils.arrayFirst(session.People, function (person)
                {
                    return (person.FirstName.toLowerCase().indexOf(search) > -1) || (person.LastName.toLowerCase().indexOf(search) > -1);
                });
            }
            var dateResult = selectedDay && session.ScheduledDateTime.clone().beginningOfDay().valueOf() === selectedDay.date.valueOf();
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
            ko.utils.arrayForEach(this.days(),
                function (day)
                {
                    if (day.date.valueOf() !== clickedDay.date.valueOf())
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
        //data.ScheduledSessions
        // by day
        //     by timeslot

        var favoriteSessionIDs = amplify.store("favoriteSessionIDs");
        for (var i = 0; i < data.d.length; i++)
        {
            var session = data.d[i];
            session.ScheduledDateTime = jsonStringToDate(session.ScheduledDateTime);
            session.isFavorite = ko.observable(favoriteSessionIDs && (favoriteSessionIDs.indexOf(session.SessionId) > -1));
        }
        viewModel.sessions(data.d);
		var futureSessions = ko.utils.arrayFilter(viewModel.sessions(), function(session) 
            {
                return session.ScheduledDateTime.clone().addHours(1).isFuture();
            });
        if (!futureSessions.length)
        {
            viewModel.showOld(true);
        }

        console.log(data.d[0]);

        viewModel.favoriteSessionIDs = ko.computed(function ()
        {
            var favSessions = ko.utils.arrayFilter(this.sessions(), function (session) { return session.isFavorite(); });
            var favSessionIDs = ko.utils.arrayMap(favSessions, function (session) { return session.SessionId; });
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
				amplify.store("selectedDateValue", newValue.date.valueOf());
			}
        });

    });
});