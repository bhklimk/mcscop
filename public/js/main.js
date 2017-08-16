var lastSelection = null;
if (!permissions)
    permissions = [];

function getDate() {
    var date = new Date();
    return date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds();
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function dateStringToEpoch(value) {
    var parts = value.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
    return(Date.UTC(parts[1], parts[2]-1, parts[3], parts[4], parts[5], parts[6], parts[7]));
}

function epochToDateString(value){
    if (isNaN(value))
        return value;
    var date = new Date(parseInt(value));
    return (date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
}

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

$(document).ready(function() {
    var missions_rw = false;
    if (permissions.indexOf('all') !== -1 || permissions.indexOf('manage_missions') !== -1)
        missions_rw = true;

    $("#missions").jqGrid({
        datatype: 'json',
        mtype: 'POST',
        url: 'api/missions',
        editurl: 'api/missions',
        autowidth: true,
        regional: 'en',
        maxHeingt: 600,
        height: 400,
        reloadAfterSubmit: true,
        pager: '#missionPager',
        pgbuttons: false,
        pgtext: null,
        viewrecords: false,
        colModel: [
            { label: ' ', name: 'actions', formatter: 'actions', width: 10, formatoptions: {
                    keys: true,
                    editbutton: false,
                    delbutton: missions_rw
                }
            },
            { label: 'Mission Id', name: 'id', width: 15, key: true, editable: false },
            { label: 'Mission Name', name: 'name', width: 45, editable: missions_rw, edittype: 'text', formatter: 'showlink', formatoptions: {
                    baseLinkUrl: 'cop',
                    idName: 'mission'
                }
            },
            { label: 'Start Date', name: 'start_date', width: 60, editable: missions_rw, formatter: epochToDateString, editoptions: {
                dataInit: function (element) {
                    $(element).datetimepicker({
                        dateFormat: "yy-mm-dd",
                        timeFormat: "HH:mm:ss.l",
                        controlType: 'select',
                        showMillisec: false
                    })
                },
                editrules: {
                    date: true,
                    minValue: 0
                },
                formatoptions: {
                    newformat: 'yy-mm-dd HH:mm:ss.l'
                },
                defaultValue: getDate()
            }},
            { label: 'Battle Captain', name: 'analyst', width: 30, editable: false },
        ],
        sortable: true,
        serializeRowData: function (data) {
            data.start_date = dateStringToEpoch(data.start_date);
            return data;
        },
        onSelectRow: function (id) {
            if (id && id !== lastSelection && missions_rw) {
                var grid = $("#missions");
                grid.jqGrid('restoreRow', lastSelection);
                $("table#missions tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
                $("table#missions tr#"+$.jgrid.jqID(id)+ " div.ui-inline-edit").hide();
                $("table#missions tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
                $("table#missions tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
                lastSelection = id;
                grid.jqGrid('editRow', id, {keys: true, aftersavefunc: function () {
                        $("table#missions tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-del").show();
                        $("table#missions tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-edit").show();
                        $("table#missions tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-save").hide();
                        $("table#missions tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-cancel").hide();
                        lastSelection = null;
                    },
                    afterrestorefunc: function (options) {
                        lastSelection = null;
                        $('#missions').jqGrid('resetSelection');
                    }
                });
            }
        },
    });
    $('#missions').navGrid('#missionPager', {
        add: false,
        edit: false,
        del: false
    });
    $('#missions').inlineNav('#missionPager', {
        edit: false,
        add: missions_rw,
        del: false,
        save: false,
        cancel: false,
        addParams: {
            addRowParams: {
                keys: true,
                successfunc: function() {
                    $("#missions").trigger("reloadGrid");
                },
                url: 'api/missions'
            },
        }
    });

    $(window).bind("resize", function () {
        $("#missions").jqGrid("setGridWidth", $("#missions").closest(".jumbotron").width());
    }).triggerHandler("resize")

});
