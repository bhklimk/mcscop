var lastSelection;

if (!permissions)
    permissions = [];

$(document).ready(function() {
    var roles_rw = false;
    console.log(permissions);
    if (permissions.indexOf('all') !== -1 || permissions.indexOf('manage_roles') !== -1)
        roles_rw = true;

    $("#roles").jqGrid({
        datatype: 'json',
        mtype: 'POST',
        url: 'api/roles',
        editurl: 'api/roles',
        autowidth: true,
        regional: 'en',
        height: 300,
        reloadAfterSubmit: true,
        colModel: [
            { label: ' ', name: 'actions', formatter: 'actions', width: 10, formatoptions: {
                    keys: true,
                    editbutton: false,
                    delbutton: roles_rw
                }
            },
            { label: 'Role Id', name: 'id', key: true, editable: false, hidden: true},
            { label: 'Name', name: 'name', width: 50, editable: roles_rw, edittype: 'text' },
            { label: 'Sub-Roles', name: 'sub_roles', width: 150, editable: roles_rw, edittype: 'select', editoptions: {
                    dataUrl: 'getroles',
                    multiple: true, 
                }
            },

        ],
        pager: '#rolesPager',
        pgbuttons: false,
        pgtext: null,
        onSelectRow: function (id) {
            if (id && id !== lastSelection && roles_rw) {
                var grid = $("#roles");
                grid.jqGrid('restoreRow', lastSelection);
                $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
                $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-edit").hide();
                $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
                $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
                lastSelection = id;
                grid.jqGrid('editRow', id, {keys: true, aftersavefunc: function () {
                        $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-del").show();
                        $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-edit").show();
                        $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-save").hide();
                        $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-cancel").hide();
                        lastSelection = null;
                    }
                });
            }
        }
    });
    $('#roles').jqGrid('navGrid', '#rolesPager', {
        add: false,
        edit: false,
        del: false,
    });
    $('#roles').jqGrid('inlineNav','#rolesPager', {
        edit: false,
        add: roles_rw,
        del: false,
        save: false,
        cancel: false,
        addParams: {
            addRowParams: {
                keys: true,
                successfunc: function() {
                    $("#roles").trigger("reloadGrid");
                },
                url: 'api/roles'
            },
        }
    });

    $(window).bind("resize", function () {
        $("#roles").jqGrid("setGridWidth", $("#roles").closest(".jumbotron").width());
    }).triggerHandler("resize")

    var users_rw = false;
    if (permissions.indexOf('all') !== -1 || permissions.indexOf('manage_users') !== -1)
        users_rw = true;

    $("#users").jqGrid({
        datatype: 'json',
        mtype: 'POST',
        url: 'api/users',
        editurl: 'api/users',
        autowidth: true,
        maxHeight: 600,
        height: 300,
        reloadAfterSubmit: true,
        colModel: [
            { label: ' ', name: 'actions', formatter: 'actions', width: 15, formatoptions: {
                    keys: true,
                    editbutton: false,
                    delbutton: users_rw
                }
            },
            { label: 'id', name: 'id', key: true, editable: false, hidden: true },
            { label: 'Username', name: 'username', width: 50, editable: users_rw, edittype: 'text' },
            { label: 'Name', name: 'name', width: 50, editable: users_rw, edittype: 'text' },
            { label: 'Set Password', name: 'password', width: 50, editable: users_rw, edittype: 'password' },
            { label: 'Role', name: 'role', width: 50, editable: users_rw, edittype: 'select', editoptions: {
                    dataUrl: 'getroles',
                    multiple: false,
                }
            },
            { label: 'Permissions', name: 'permissions', width: 200, editable: users_rw, edittype: 'select', formatter: 'select', editoptions: {
                    value: {none: 'None', all:'All', manage_missions:'Manage Missions', manage_users:'Manage Users', manage_roles:'Manage Roles', modify_diagram: 'Modify Diagram', create_events: 'Create Events', delete_events: 'Delete Events', modify_notes: 'Modify Notes', create_opnotes: 'Create Opnotes', delete_opnotes: 'Delete Opnotes', modify_files: 'Modify Files'},
                    multiple: true,
                }
            }

        ],
        sortable: true,
        pager: '#usersPager',
        pgbuttons: false,
        pgtext: null,
        onSelectRow: function (id) {
            if (id && id !== lastSelection && users_rw) {
                var grid = $("#users");
                grid.jqGrid('restoreRow', lastSelection);
                $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
                $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-edit").hide();
                $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
                $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
                lastSelection = id;
                grid.jqGrid('editRow', id, {keys: true, aftersavefunc: function () {
                        $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-del").show();
                        $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-edit").show();
                        $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-save").hide();
                        $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-cancel").hide();
                        lastSelection = null;
                    }
                });
            }
        }
    });
    $('#users').navGrid('#usersPager', {
        add: false,
        edit: false,
        del: false
    });
    $('#users').inlineNav('#usersPager', {
        edit: false,
        add: users_rw,
        del: false,
        cancel: false,
        save: false,
        addParams: {
            addRowParams: {
                keys: true,
                successfunc: function() {
                    $("#users").trigger("reloadGrid");
                },
                url: 'api/users'
            },
        }
    });
    $(window).bind("resize", function () {
        $("#users").jqGrid("setGridWidth", $("#users").closest(".jumbotron").width());
    }).triggerHandler("resize")

});
