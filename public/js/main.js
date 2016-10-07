var DateField = function(config) {
    jsGrid.Field.call(this, config);
};

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

DateField.prototype = new jsGrid.Field({
    css: "date-field",
    align: "center",
    sorter: function(date1, date2) {
        return new Date(date1) - new Date(date2);
    },
    itemTemplate: function(value) {
        var date = new Date(value);
        return (date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
    },
    insertTemplate: function(value) {
        return this._insertPicker = $("<input>").datetimepicker({
            timeFormat: "HH:mm:ss.l",
            controlType: 'select',
            showMillisec: true
        });
    },
    editTemplate: function(value) {
        this._editPicker = $("<input>").datetimepicker({
            setDate: new Date(value),
            timeFormat: "HH:mm:ss.l",
            controlType: 'select',
            showMillisec: true
        });
        this._editPicker.datetimepicker('setDate', new Date(value));
        return this._editPicker;
    },
    insertValue: function() {
        return this._insertPicker.datepicker("getDate").getTime();
    },
    editValue: function() {
        return this._editPicker.datepicker("getDate").getTime();
    }
});
jsGrid.fields.date = DateField;

$(document).ready(function() {
    $('#missions').jsGrid({
        autoload: false,
        width: '100%',
        editing: true,
        sorting: true,
        paging: true,
        autoload: true,
        fields: [
            { name: 'id', type: 'number', css: 'hide', width: 0},
            { name: 'name', title: 'Mission Name', type : 'text', width: 65},
            { name: 'start_date', title: 'Start Date', type: 'date', width: 25},
            { name: 'analyst', title: 'Battle Captain', type: 'number', width: 25},
            {
                type: "control",
                editButton: false,
                headerTemplate: function() {
                    var grid = this._grid;
                    var isInserting = grid.inserting;
                    var $button = $("<input>").attr("type", "button")
                        .addClass([this.buttonClass, this.modeButtonClass, this.insertModeButtonClass].join(" "))
                        .on("click", function() {
                            isInserting = !isInserting;
                            grid.option("inserting", isInserting);
                        });

                    return $button;
                }
            }
        ],
        controller: {
            loadData: function () {
                var d = $.Deferred();
                $.ajax({
                    type: 'POST',
                    url: '/api',
                    data: {
                        action: 'select',
                        table: 'missions'
                    }
                }).done(function(response) {
                    d.resolve(response);
                });
                return d.promise();
            },
            insertItem: function(item) {
                var d = $.Deferred();
                $.ajax({
                    type: 'POST',
                    url: '/api',
                    data: {
                        action: 'insert',
                        table: 'missions',
                        row: JSON.stringify(item)
                    }
                }).done(function() {
                    d.resolve();
                });
                return d.promise();
            },
            updateItem: function(item) {
            }
        }
    });
});
