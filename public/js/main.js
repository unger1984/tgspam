const interval = 5000; //ms
let idleInterval = null;
let lastLog = null;
let taskActive = false;

_.template.formatDateTime = (date) => {
    const n = (m) => {
        if (parseInt(m) < 10)
            return "0" + m
        return m;
    }
    let d = new Date(date), // or d = new Date(date)
        fragments = [
            n(d.getDate()),
            n(d.getMonth() + 1),
            n(d.getFullYear())
        ];
    return fragments.join('.') + " " + n(d.getHours()) + ":" + n(d.getMinutes()) + ":" + n(d.getSeconds());
};

const template = async (path, data) => {
    let res = await $.ajax("/tpl/" + path + ".html")
    $('#page').html(_.template(res)(data));
    return;
}

const startSources = async () => {
    $('#filter').addClass("deactivate")
    $('#smservice').prop('disabled', true)
    $('#maessage').prop('disabled', true)
    $('#country').prop('disabled', true)
    $('#count').prop('disabled', true)
    $('#capacity').prop('disabled', true)
    $('#start').prop('disabled', true)
    $('#start').html('<img src="/img/preloader.gif" style="width: 14px; height: 14px">')

    let message = $('#maessage').val().trim()
    if (message.length <= 0) {
        $('#start').html('Старт');
        $('#filter').removeClass("deactivate")
        $('#smservice').prop('disabled', false)
        $('#country').prop('disabled', false)
        $('#maessage').prop('disabled', false)
        $('#count').prop('disabled', false)
        $('#capacity').prop('disabled', false)
        $('#start').prop('disabled', false)
        $('#stop').prop('disabled', true)
        alert("Сообщение не должно быть пустым!");
    } else {

        let task = {
            smservice: $('#smservice').val(),
            country: $('#country').val(),
            count: $('#count').val(),
            algoritm: $('#algoritm').val(),
            max: $('#max').val(),
            message: message
        }

        let res = await $.ajax({
            url: "/api/tasks/start",
            method: "POST",
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({task: task})
        })

        if (res.status) {
            taskActive = true;

            $('#start').html('Старт');
            $('#stop').prop('disabled', false)
        } else {
            $('#start').html('Старт');
            $('#filter').removeClass("deactivate")
            $('#smservice').prop('disabled', false)
            $('#country').prop('disabled', false)
            $('#maessage').prop('disabled', false)
            $('#count').prop('disabled', false)
            $('#capacity').prop('disabled', false)
            $('#start').prop('disabled', false)
            $('#stop').prop('disabled', true)
            alert(res.error);
        }
    }
}

const stopSources = async () => {
    $('#stop').prop('disabled', true);
    $('#stop').html('<img src="/img/preloader.gif" style="width: 14px; height: 14px">')

    let res = await $.ajax({
        url: "/api/tasks/stop",
        method: "POST",
        contentType: "application/json; charset=utf-8",
    })

    console.log(res);

    taskActive = false;

    $('#stop').html('Стоп');
    $('#filter').removeClass("deactivate")
    $('#smservice').prop('disabled', false)
    $('#country').prop('disabled', false)
    $('#maessage').prop('disabled', false)
    $('#count').prop('disabled', false)
    $('#capacity').prop('disabled', false)
    $('#start').prop('disabled', false)
    $('#stop').prop('disabled', true)
}

const updateLog = async () => {
    let url = "/api/logs/";
    if (lastLog !== null)
        url += lastLog;
    let res = await $.ajax(url)
    if (res.status) {
        let last = lastLog;
        for (let i = 0; i < res.list.length; i++) {
            let log = res.list[i];
            $('#log').append(_.template.formatDateTime(log.created) + ' ' + log.message + "<br>\n");
            last = (new Date(log.created)).getTime()
        }
        lastLog = last
        if (res.list.length > 0)
            $("#log").scrollTop($("#log")[0].scrollHeight);
    }
    res = await $.ajax("/api/tasks");
    if (res.status) {
        $('#counter').html(res.sent + " / " + res.good + " / " + res.joined + " / " + res.total);
        if (taskActive !== res.task.active) {
            if (res.task.active) {
                $('#filter').addClass("deactivate")
                $('#smservice').prop('disabled', true)
                $('#country').prop('disabled', true)
                $('#count').prop('disabled', true)
                $('#capacity').prop('disabled', true)
                $('#start').prop('disabled', true)
                $('#maessage').prop('disabled', false)
                $('#start').html('Старт');
                $('#stop').prop('disabled', false)
            } else {
                $('#stop').html('Стоп');
                $('#filter').removeClass("deactivate")
                $('#smservice').prop('disabled', false)
                $('#country').prop('disabled', false)
                $('#maessage').prop('disabled', true)
                $('#count').prop('disabled', false)
                $('#capacity').prop('disabled', false)
                $('#start').prop('disabled', false)
                $('#stop').prop('disabled', true)
            }
        }
    }
    return res.task;
}

const updateSources = async () => {
    const task = await updateLog();
    let res = await $.ajax("/api/phones/list")
    if (res.status) {
        for (let i = 0; i < res.list.length; i++) {
            let phone = res.list[i];
            let tds = $('#tr_' + phone._id).children('td').toArray();
            if (tds.length > 0) {
                $(tds[0]).html((i + 1))
                $(tds[4]).html(phone.joined + " / " + task.max)
                $(tds[5]).html(phone.sent)
                $(tds[6]).html(phone.active ? (phone.last ? _.template.formatDateTime(phone.last) : "") : phone.error)
                if (phone.active) {
                    $('#tr_' + phone._id).removeClass("red")
                    $('#tr_' + phone._id).addClass("green")
                    $(tds[6]).prop('colspan', 2)
                    if (tds.length === 8) {
                        $(tds[7]).remove();
                    }
                } else {
                    $('#tr_' + phone._id).addClass("red")
                    $('#tr_' + phone._id).removeClass("green")
                    $(tds[6]).prop('colspan', 1)
                    if (tds.length < 8) {
                        $('#tr_' + phone._id).append('<td><img data-id="' + phone._id + '" id="retry" src="/img/retry.png" class="rowbutton"></td>')
                    }else{
                        $(tds[7]).find('img').prop('src','/img/retry.png')
                    }
                }


            } else {
                // еще нет такого
                $('#tbody').append('<tr id="tr_' + phone._id + '" class="trrow ' + (phone.active ? "green" : "red") + '">' +
                    '        <td>' + (i + 1) + '</td>' +
                    '        <td>' +
                    '            <input type="checkbox" class="ids" value="' + phone._id + '">' +
                    '        </td>' +
                    '        <td class="text-left">+' + phone.number + '</td>' +
                    '        <td>' + _.template.formatDateTime(phone.created) + '</td>' +
                    '        <td>' + (phone.joined + " / " + task.max) + '</td>' +
                    '        <td>' + phone.sent + '</td>' +
                    '        <td ' + (phone.active ? 'colspan="2"' : '') + '>' + (phone.active ? (phone.last ? _.template.formatDateTime(phone.last) : "") : phone.error) + '</td>' +
                    (!phone.active ? '<td><img data-id="' + phone._id + '" src="/img/retry.png" class="rowbutton retry"></td>' : '') +
                    '    </tr>'
                );
            }
        }
        // delete all failds
        try {
            let trs = $('.trrow').toArray();
            for (let i = 0; i < trs.length; i++) {
                let _id = $(trs[i]).attr('id').replace('tr_', '');
                let found = false;
                for (let j = 0; j < res.list.length; j++) {
                    if (res.list[j]._id === _id)
                        found = true
                }
                if (!found) {
                    $(trs[i]).remove()
                }
            }
        } catch (e) {
            console.log(e)
        }
    }
    $('.retry').click((e) => {
        e.preventDefault();
        $(e.target).prop('src', '/img/preloader.gif');
        let id = $(e.target).data('id')

        $.ajax({
            url: "/api/phones/activate",
            method: "POST",
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({id: id})
        })
            .then(r => {
                console.log(r);
                if (r.status) {

                } else {
                    alert('Что-то пошло не так')
                }
            })
            .catch(e => {
                console.log(e);
            })
    })

}

const getCountryes = (smsservice, country) => {
    let opts = "";
    switch (smsservice) {
        case 'sim5':
            opts = '<option value="ru" ' + (country === "ru" ? "selected" : "") + '>Россия</option>' +
                '                <option value="kz" ' + (country === "kz" ? "selected" : "") + '>Казахстан</option>' +
                '                <option value="ph" ' + (country === "ph" ? "selected" : "") + '>Филипины</option>'
            break;
        case 'simsms':
            opts = '<option value="ru" ' + (country === "ru" ? "selected" : "") + '>Россия</option>' +
                '                <option value="ua" ' + (country === "ua" ? "selected" : "") + '>Украина</option>' +
                '                <option value="kz" ' + (country === "kz" ? "selected" : "") + '>Казахстан</option>' +
                '                <option value="uk" ' + (country === "uk" ? "selected" : "") + '>Великобритания</option>' +
                '                <option value="id" ' + (country === "id" ? "selected" : "") + '>Индонезия</option>' +
                '                <option value="my" ' + (country === "my" ? "selected" : "") + '>Малазия</option>' +
                '                <option value="ph"  + (country === "kz" ? "selected" : "") + \'>Филипины</option>'
            break;
        case 'sms-reg':
            opts = '<option value="all" \' + (country === "all" ? "selected" : "") + \'>Любая</option>' +
                '               <option value="ru" ' + (country === "ru" ? "selected" : "") + '>Россия</option>' +
                '                <option value="ua" ' + (country === "ua" ? "selected" : "") + '>Украина</option>' +
                '                <option value="kz" ' + (country === "kz" ? "selected" : "") + '>Казахстан</option>'
            break;
        case 'smska':
            opts = '<option value="ru" ' + (country === "ru" ? "selected" : "") + '>Россия</option>' +
                '                <option value="ua" ' + (country === "ua" ? "selected" : "") + '>Украина</option>'
            break;
        case 'onlinesms':
            opts = '<option value="all" ' + (country === "al" ? "selected" : "") + '>Любая</option>';
            break;
        case 'sms-activate':
        default:
            opts = '<option value="ru" ' + (country === "ru" ? "selected" : "") + '>Россия</option>' +
                '                <option value="ua" ' + (country === "ua" ? "selected" : "") + '>Украина</option>' +
                '                <option value="kz" ' + (country === "kz" ? "selected" : "") + '>Казахстан</option>'
            break;
    }
    return opts;
}

const getSources = async () => {
    if (idleInterval !== null)
        clearInterval(idleInterval)
    lastLog = null;

    $('#page').html('<div class="center"><img src="/img/preloader.gif"></div>');
    let res = await $.ajax("/api/phones/list")
    let tasks = await $.ajax("/api/tasks");
    tasks.task.countryes = getCountryes(tasks.task.smservice, tasks.task.country)
    taskActive = tasks.task.active;
    await template("sources", {items: res.list, task: tasks.task, sent: tasks.sent, good: tasks.good, joined: tasks.joined, total: tasks.total})

    updateLog();
    $('#clear').click(e => {
        e.preventDefault();
        if (confirm('Удалить все источники?'))
            $.ajax({
                url: "/api/phones/list",
                method: "DELETE"
            }).then(r => {
                getSources();
            })
    })
    $('#js-delete-all').change(() => {
        $(".ids").prop('checked', $('#js-delete-all').is(":checked"));
    })
    $('#delete').click(e => {
        e.preventDefault();
        let ids = []
        let elms = $('.ids').toArray();
        for (let i = 0; i < elms.length; i++) {
            if ($(elms[i]).is(':checked')) {
                ids.push($(elms[i]).val())
            }
        }
        if (ids.length > 0) {
            if (confirm('Удалить ' + ids.length + ' источников?'))
                $.ajax({
                    url: "/api/phones",
                    method: "PUT",
                    dataType: 'json',
                    contentType: "application/json; charset=utf-8",
                    data: JSON.stringify({list: ids})
                }).then(r => {
                    getSources();
                })
        }
    })
    $('#start').click((e) => {
        e.preventDefault();
        startSources();
    })
    $('#stop').click((e) => {
        e.preventDefault();
        stopSources();
    })
    $('#smservice').change(() => {
        $('#country').html(getCountryes($('#smservice').val()));
    })
    $('#clearlog').click((e) => {
        e.preventDefault()
        $.ajax({
            url: "/api/logs",
            method: "DELETE"
        }).then(r => {
            $('#log').html('')
            lastLog = null;
        })
    })
    $('.retry').click((e) => {
        e.preventDefault();
        $(e.target).prop('src', '/img/preloader.gif');
        let id = $(e.target).data('id')

        $.ajax({
            url: "/api/phones/activate",
            method: "POST",
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({id: id})
        })
            .then(r => {
                console.log(r);
                if (r.status) {

                } else {
                    alert('Что-то пошло не так')
                }
            })
            .catch(e => {
                console.log(e);
            })
    })
    idleInterval = setInterval(updateSources, interval)
}

const updateTargets = async () => {
    let res = await $.ajax("/api/chats/list")
    if (res.status) {
        for (let i = 0; i < res.list.length; i++) {
            let chat = res.list[i];
            let tds = $('#tr_' + chat._id).children('td').toArray();
            $(tds[4]).html(chat.number === 0 ? "" : "+" + chat.number)
            $(tds[5]).html(chat.active ? (chat.last ? _.template.formatDateTime(chat.last) : "") : chat.error)
            if (chat.active) {
                $('#tr_' + chat._id).removeClass("red")
                $('#tr_' + chat._id).addClass("green")
            } else {
                $('#tr_' + chat._id).addClass("red")
                $('#tr_' + chat._id).removeClass("green")
            }
        }
    }
}

const getTargets = async () => {
    if (idleInterval !== null)
        clearInterval(idleInterval)

    $('#page').html('<div class="center"><img src="/img/preloader.gif"></div>');
    let res = await $.ajax("/api/chats/list")
    await template("targets", {items: res.list})

    $('#submit').click((e) => {
        e.preventDefault();
        let list = $('#list').val().split("\n");

        console.log(list);
        $.ajax({
            url: "/api/chats/list",
            method: "POST",
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({list: list})
        }).then(r => {
            getTargets();
        })
        return false;
    })
    $('#clear').click(e => {
        e.preventDefault();
        if (confirm('Удалить всех получателей?'))
            $.ajax({
                url: "/api/chats/list",
                method: "DELETE"
            }).then(r => {
                getTargets();
            })
    })
    $('#js-delete-all').change(() => {
        $(".ids").prop('checked', $('#js-delete-all').is(":checked"));
    })
    $('#delete').click(e => {
        e.preventDefault();
        let ids = []
        let elms = $('.ids').toArray();
        for (let i = 0; i < elms.length; i++) {
            if ($(elms[i]).is(':checked')) {
                ids.push($(elms[i]).val())
            }
        }
        if (ids.length > 0) {
            if (confirm('Удалить ' + ids.length + ' получателей?'))
                $.ajax({
                    url: "/api/chats",
                    method: "PUT",
                    dataType: 'json',
                    contentType: "application/json; charset=utf-8",
                    data: JSON.stringify({list: ids})
                }).then(r => {
                    getTargets();
                })
        }
    })
    idleInterval = setInterval(updateTargets, interval)
}

const updateProxys = async () => {
    let proxy = await $.ajax("/api/settings/proxy");
    if (proxy.status) {
        $('#remote').html(proxy.ip)
    } else {
        $('#remote').html(proxy.error)
    }
}

const getProxys = async () => {
    if (idleInterval !== null)
        clearInterval(idleInterval)
    lastLog = null;

    $('#page').html('<div class="center"><img src="/img/preloader.gif"></div>');
    let proxy = await $.ajax("/api/settings/proxy");
    if (proxy.status) {
        proxy = proxy.ip
    } else {
        proxy = proxy.error
    }
    await template("proxys", {proxy: proxy})

    $('#save').click((e) => {
        e.preventDefault()
        let ip = $('#ip').val().trim();
        let port = $('#port').val().trim();
        if (ip.length <= 0 || port.length <= 0) {
            alert('Заполните данные ip и порт')
            return
        }
        $.ajax({
            url: "/api/settings/proxy",
            method: "PUT",
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({ip: ip, port: port, login: $('#login').val(), password: $('#password').val()})
        }).then(r => {
            console.log(r)
            getProxys();
        })
    })

    idleInterval = setInterval(updateProxys, interval)
}

$(function () {
    $('.menulink').click(function (e) {
        e.preventDefault();
        $('.menulink').removeClass("active")
        $(this).addClass("active")

        let func = $(this).attr('href').replace('#', '');
        switch (func) {
            case "sources":
                getSources();
                break;
            case "targets":
                getTargets();
                break;
            case "proxys":
                getProxys();
                break;
        }
    })
    getSources();
})