var users = [{id:0, name:'none'}];

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
            controlType: 'select'
        });
    },
    editTemplate: function(value) {
        this._editPicker = $("<input>").datetimepicker({
            setDate: new Date(value),
            controlType: 'select'
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

var origFinishInsert = jsGrid.loadStrategies.DirectLoadingStrategy.prototype.finishInsert;
jsGrid.loadStrategies.DirectLoadingStrategy.prototype.finishInsert = function(insertedItem) {
    if(insertedItem.insertFailed) {
        return;
    }
    origFinishInsert.apply(this, arguments);
}
var origFinishUpdate = jsGrid.loadStrategies.DirectLoadingStrategy.prototype.finishUpdate;
jsGrid.loadStrategies.DirectLoadingStrategy.prototype.finishUpdate = function(updatedItem) {
    if(updatedItem.updateFailed) {
        return;
    }
    origFinishUpdate.apply(this, arguments);
}
var origFinishDelete = jsGrid.loadStrategies.DirectLoadingStrategy.prototype.finishDelete;
jsGrid.loadStrategies.DirectLoadingStrategy.prototype.finishDelete = function(deletedItem) {
    if(deletedItem.deleteFailed) {
        return;
    }
    origFinishDelete.apply(this, arguments);
}

$(document).ready(function() {
    $('#missions').jsGrid({
        autoload: false,
        width: '100%',
        editing: true,
        sorting: true,
        paging: true,
        autoload: true,
        rowClick: function(args) {
            return false;
        },
        fields: [
            { name: 'id', type: 'number', css: 'hide', width: 0},
            { name: 'name', title: 'Mission Name', type : 'text', width: 65, itemTemplate: function(value, item) {
                return ('<a href="cop?mission=' + item.id + '">' + item.name + "</a>");
                }
            },
            { name: 'start_date', title: 'Start Date', type: 'date', width: 25},
            { name: 'analyst', title: 'Battle Captain', type: 'select', items: users, valueField: 'id', textField: 'name', width: 65, filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            {
                type: "control",
                editButton: true,
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
                    url: 'api',
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
                    url: 'api',
                    data: {
                        action: 'insert',
                        table: 'missions',
                        row: JSON.stringify(item)
                    }
                }).done(function(res) {
                    if (res !== 'OK') {
                        $('#modal-title').html('Error!');
                        $('#modal-body').html('<p>Unable to insert mission.</p>');
                        $('#modal-footer').html('<button type="button" class="button btn btn-default" data-dismiss="modal">Close</button>');
                        $('#modal').modal('show')
                        item.insertFailed = true;
                    }
                    d.resolve();
                });
                return d.promise();
            },
            updateItem: function(item) {
                var d = $.Deferred();
                $.ajax({
                    type: 'POST',
                    url: 'api',
                    data: {
                        action: 'update',
                        table: 'missions',
                        row: JSON.stringify(item)
                    }
                }).done(function(res) {
                    if (res !== 'OK') {
                        $('#modal-title').html('Error!');
                        $('#modal-body').html('<p>Unable to update mission.</p>');
                        $('#modal-footer').html('<button type="button" class="button btn btn-default" data-dismiss="modal">Close</button>');
                        $('#modal').modal('show')
                        item.updateFailed = true;
                    }
                    d.resolve();
                });
                return d.promise();
            },
            deleteItem: function(item) {
                var d = $.Deferred();
                $.ajax({
                    type: 'POST',
                    url: 'api',
                    data: {
                        action: 'delete',
                        table: 'missions',
                        id: JSON.stringify(item.id)
                    }
                }).done(function(res) {
                    if (res !== 'OK') {
                        $('#modal-title').html('Error!');
                        $('#modal-body').html('<p>Unable to delete mission.</p>');
                        $('#modal-footer').html('<button type="button" class="button btn btn-default" data-dismiss="modal">Close</button>');
                        $('#modal').modal('show')
                        item.deleteFailed = true;
                    }
                    d.resolve();
                });
                return d.promise();
            }
        }
    });
    $('#users').jsGrid({
        autoload: false,
        width: '100%',
        editing: true,
        sorting: true,
        paging: true,
        autoload: true,
        rowClick: function(args) {
            return false;
        },
        fields: [
            { name: 'id', type: 'number', css: 'hide', width: 0},
            { name: 'username', title: 'Username', type : 'text', width: 65},
            { name: 'name', title: 'Name', type : 'text', width: 65},
            { name: 'password', title: 'Password', type : 'text', width: 65},
            { name: 'access_level', title: 'Access Level', type: 'number', width: 45},
            {
                type: "control",
                editButton: true,
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
                    url: 'api',
                    data: {
                        action: 'select',
                        table: 'users'
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
                    url: 'api',
                    data: {
                        action: 'insert',
                        table: 'users',
                        row: JSON.stringify(item)
                    }
                }).done(function(res) {
                    if (res == 'OK') {
                        item.password = '********';
                    } else {
                        $('#modal-title').html('Error!');
                        $('#modal-body').html('<p>Unable to insert user.</p>');
                        $('#modal-footer').html('<button type="button" class="button btn btn-default" data-dismiss="modal">Close</button>');
                        $('#modal').modal('show')
                        item.insertFailed = true;
                    }
                    d.resolve();
                });
                return d.promise();
            },
            updateItem: function(item) {
                var d = $.Deferred();
                $.ajax({
                    type: 'POST',
                    url: 'api',
                    data: {
                        action: 'update',
                        table: 'users',
                        row: JSON.stringify(item)
                    }
                }).done(function(res) {
                    if (res == 'OK') {
                        item.password = '********';
                    } else {
                        $('#modal-title').html('Error!');
                        $('#modal-body').html('<p>Unable to update user.</p>');
                        $('#modal-footer').html('<button type="button" class="button btn btn-default" data-dismiss="modal">Close</button>');
                        $('#modal').modal('show')
                        item.updateFailed = true;
                    }
                    d.resolve();
                });
                return d.promise();
            },
            deleteItem: function(item) {
                var d = $.Deferred();
                $.ajax({
                    type: 'POST',
                    url: 'api',
                    data: {
                        action: 'delete',
                        table: 'users',
                        id: JSON.stringify(item.id)
                    }
                }).done(function(res) {
                    if (res !== 'OK') {
                        $('#modal-title').html('Error!');
                        $('#modal-body').html('<p>Unable to delete user.</p>');
                        $('#modal-footer').html('<button type="button" class="button btn btn-default" data-dismiss="modal">Close</button>');
                        $('#modal').modal('show')
                        item.deleteFailed = true;
                    }
                    d.resolve();
                });
                return d.promise();
            }
        }
    });

});
