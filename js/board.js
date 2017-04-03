// Reload this page every 10 minutes.
setTimeout(function() {
    location.reload();
}, 1000 * 60 * 10);

$(document).ready(function () {
    weatherApp();
    vasttrafikApp();
});


function vasttrafikApp() {
    var NOTE_ELEMENT = document.createElement("div");
    var UPDATE_TIME_MSECS = 1000 * 30; // 30 seconds
    var AUTH_KEY_UPDATE_TIME_MSECS = 3000 * 1000; // 3000 seconds
    var NOTE_ELEMENT_IN_BODY = false;
    var token = 0;
    NOTE_ELEMENT.id = "tram_note";

    var convert_vasttrafik_data = function (data) {
        // Don't inherit prototype
        var departure_hash = Object.create(null);

        var now = new Date(data.DepartureBoard.serverdate + " " + data.DepartureBoard.servertime);
        var i = 0;
        for (; i < data.DepartureBoard.Departure.length; i++) {
            var departure = data.DepartureBoard.Departure[i];
            var hash = departure.sname + departure.direction;

            if (departure_hash[hash] === undefined) {
                departure_hash[hash] = Object.create(null);
                departure_hash[hash].name = departure.sname;
                departure_hash[hash].direction = departure.direction;
                departure_hash[hash].color = hexToRgb(departure.fgColor);

                if (departure.rtDate !== undefined && departure.rtTime !== undefined) {
                    var diff = (new Date(departure.rtDate + " " + departure.rtTime)) - now;
                    departure_hash[hash].minutes = Math.floor(diff / 1000 / 60);
                } else {
                    var diff = (new Date(departure.date + " " + departure.time)) - now;
                    departure_hash[hash].minutes = Math.floor(diff / 1000 / 60);
                }
            } else {
                // Add next departure time to existing hash object
                if (departure.rtDate !== undefined && departure.rtTime !== undefined) {
                    var diff = (new Date(departure.rtDate + " " + departure.rtTime)) - now;
                    departure_hash[hash].next = Math.floor(diff / 1000 / 60);
                } else {
                    var diff = (new Date(departure.date + " " + departure.time)) - now;
                    departure_hash[hash].next = Math.floor(diff / 1000 / 60);
                }
            }
        }

        // convert departure_hash to array (so we can sort it)
        var departures = [];
        var cur = 0;
        for (dep in departure_hash) {
            departures.push(departure_hash[dep]);
            cur += 1;
        }


        var cmp_departures = function (a, b) {
            if (a.minutes > b.minutes) {
                return 1;
            } else if (a.minutes === b.minutes) {
                return 0;
            } else {
                return -1;
            }
        };

        return departures.sort(cmp_departures);
    };

    function updateVasttrafik() {
        document.body.removeChild(document.getElementById("tram_note"));
        vasttrafik();
        setTimeout(updateVasttrafik, 1000*30);
    }

    function vasttrafik_with_auth_token(callback) {
        $.ajax({
            type: "POST",
            url: "https://api.vasttrafik.se/token",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic WTZpZ05HVmZLQlhEMzd4c2tJQzNXTHp4TnVNYTpHTnVUbnZOZm54MGlQUEdrYmdHMGo5ZXM0R2Nh"
            },
            data: "grant_type=client_credentials&scope=infoboard",
            success: function (data) {
                var start_auth_time = new Date();
                function vasttrafik_timer() {
                    var now_auth_time = new Date();
                    var msecs_diff = now_auth_time - start_auth_time;

                    if (Math.floor(msecs_diff) >= AUTH_KEY_UPDATE_TIME_MSECS) {
                        return vasttrafik_with_auth_token(callback);
                    }

                    setTimeout(vasttrafik_timer, UPDATE_TIME_MSECS);

                    callback(data.access_token);
                };
                vasttrafik_timer();
            }
        });
    };

    function create_tram_table(departures) {
        // Create table
        table = document.createElement("table");
        table.cellSpacing = 0;
        tr = document.createElement("tr");
        th = document.createElement("th");
        th.colSpan = 4;
        th.classList.add("tram_day_th");

        var d = new Date();
        var day = "";
        if (d.getDay() === 0) {
            day = "Söndag";
        } else if (d.getDay() === 1) {
            day = "Måndag";
        } else if (d.getDay() === 2) {
            day = "Tisdag";
        } else if (d.getDay() === 3) {
            day = "Onsdag";
        } else if (d.getDay() === 4) {
            day = "Torsdag";
        } else if (d.getDay() === 5) {
            day = "Fredag";
        } else if (d.getDay() === 6) {
            day = "Lördag";
        }

        th.innerText = day;
        tr.appendChild(th);
        table.appendChild(tr);


        // headings
        tr = document.createElement("tr");
        th = document.createElement("th");
        th.innerText = "Linje";
        tr.appendChild(th);
        th = document.createElement("th");
        th.innerText = "Destination";
        tr.appendChild(th);
        th = document.createElement("th");
        th.innerText = "Nästa";
        tr.appendChild(th);
        th = document.createElement("th");
        th.innerText = "Därefter";
        tr.appendChild(th);
        table.appendChild(tr);


        var i = 0;
        for (; i < departures.length; i++) {
            var departure = departures[i];

            tr = document.createElement("tr");
            tr.style.backgroundColor = "rgba(" + departure.color.r + ","+ departure.color.g + "," + 
                    departure.color.b + ", 0.4)";
            td = document.createElement("td");
            td.innerText = departure.name;
            tr.appendChild(td);
            td = document.createElement("td");
            td.innerText = departure.direction;
            tr.appendChild(td);
            td = document.createElement("td");
            if (departure.minutes <= 0) {
                td.innerText = "Nu";
            } else {
                td.innerText = String(departure.minutes) + " min";
            }
            tr.appendChild(td);

            if (departure.next !== undefined) {
                td = document.createElement("td");
                td.innerText = String(departure.next) + " min";
                tr.appendChild(td);
                table.appendChild(tr);
            } else {
                td = document.createElement("td");
                td.innerText = "";
                tr.appendChild(td);
                table.appendChild(tr);
            }
        }

        return table;

    }

    function vasttrafik_get_departure_data(access_token, callback) {
        var d = new Date();
        var time = String(d.getHours()) + "%3A" + String(d.getMinutes());
        var date = String(d.getFullYear()) + "-" + String(d.getMonth() + 1) + "-" + String(d.getDate());
        var stop_id = "9021014001050000"; // vasttrafiks ID of almedal stop
        var timespan = "30"; // minutes
        $.ajax({
            type: "GET",
            headers: {
                "Authorization": "Bearer " + access_token
            },
            url: "https://api.vasttrafik.se/bin/rest.exe/v2/departureBoard?id="+stop_id+"&date="+date+"&time="+time+"&timeSpan="+timespan+"&maxDeparturesPerLine=2&format=json",
            success: function (data) {
                callback(convert_vasttrafik_data(data));
            }
        });
    };

    (function main() {
        vasttrafik_with_auth_token(function(token) {
            vasttrafik_get_departure_data(token, function(departures) {
                if (NOTE_ELEMENT.children.length !== 0) {
                    NOTE_ELEMENT.removeChild(NOTE_ELEMENT.children[0]);
                }
                NOTE_ELEMENT.appendChild(create_tram_table(departures));

                if (NOTE_ELEMENT_IN_BODY === false) {
                    document.body.appendChild(NOTE_ELEMENT);
                    NOTE_ELEMENT_IN_BODY = true;
                }
            });
        });
    }());

};


function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

weatherApp = function() {
    var updateNote = function (note, temperature, temp_unit) {
        note.innerHTML = "Det är " + temperature + " grader " + temp_unit + " ute nu.";
        return note;
    };

    var createNote = function (temperature, temp_unit) {
        note = document.createElement("div");
        note.id = "small_note";
        updateNote(note, temperature, temp_unit);
        document.body.appendChild(note);
        return note;
    };

    function updateWeather(note) {
        $.simpleWeather({
            location: '57.687747, 11.978457',
            unit: 'c',
            success: function (weather) {
                updateNote(note, weather.temp, weather.units.temp);
                document.body.appendChild(note);
            },
            error: function (error) {
                console.log(error);
            }
        });
        setTimeout(function(){updateWeather(note);}, 1000 * 60);
    }

    $.simpleWeather({
        location: '57.687747, 11.978457',
        unit: 'c',
        success: function (weather) {
            createNote(weather.temp, weather.units.temp);
            setTimeout(function(){updateWeather(note);}, 1000 * 60);
        },
        error: function (error) {
            console.log(error);
        }
    });
};
