'use strict';

const fs = require('fs');
const path = require('path');

const Marked = require('./Marked');

let inited = false;
let updating = false;
let archiveFloder;
let regexs = {
    header: /^([.\n]+)==========/,
    attribute: /(\w+)\:(.+)\n/g,
    content: /==========(.+)$/
};

/**all detail and content of all the archives.*/
let allArchives = new Array();

/**only summary content of archives*/
let summaryList = new Array();

/**Class Archive*/
class Archive {
    /**
     * Creates an instance of Archive.
     * 
     * @param {any} fileName
     * @param {any} attributes
     * @param {any} summaryCnt optional
     * 
     * @memberOf Archive
     */
    constructor(fileName, attributes, summaryCnt) {
        this.fileName = fileName;
        for (let attrName in attributes) {
            this[attrName] = attributes[attrName];
        }
        this.content = summaryCnt ? attributes.content.substring(0, summaryCnt) : attributes.content;
    }

    /**
     * get Archive HTML format
     * 
     * @returns
     * 
     * @memberOf Archive
     */
    getHTML() {
        if (this.html) return this.html;
        else return this.html = [
            `<li class="stack">`,
            `<a href="/archive/${this.fileName}" class="title">${this.title}</a>`,
            `<pre class="content">${this.content}</pre>`,
            `<span class="footnote">${new Date(this.date).toLocaleString('chinese', {timeZone: 'Asia/Shanghai',hour12:false})}</span>`,
            `</li>`
        ].join('');
    }
}

/**
 * init module by given archive floder path
 * 
 * @param {string} path
 */
function init(path) {
    archiveFloder = path;
    inited = true;
    updateArchiveList();
    fs.watch(path, () => updateArchiveList());
}

/**
 * parse specificed string into Object Archive
 * 
 * @param {String} fileName
 * @param {String} str content of file/string
 * @param {Boolean} isSummary output all content(fasle or null) / summary only(true)
 * @returns Object Archive parsed
 */
function parseArchive(fileName, str, isSummary) {
    let headerIndex = str.indexOf('==========');
    let header = str.substring(0, headerIndex + 1).trim();
    let items, attributes = {};
    while (items = regexs.attribute.exec(header)) {
        let tmpVal = items[2].split(',');
        tmpVal = tmpVal.map(e => e.trim());
        attributes[items[1].toLowerCase()] = tmpVal.length > 1 ? tmpVal : tmpVal[0];
    }
    attributes.content = str.substring(headerIndex + 11, str.length);
    attributes.content = Marked.toHtml(attributes.content);
    try {
        attributes.date = Date.parse(attributes.date);
    } catch (err) {
        throw new Error('Invalid date format, OR no Date field provided.');
    }
    let res = new Archive(fileName, attributes, isSummary ? 20 : null);
    return res;
}

/**
 * readdir and rebuild archive & summary list
 * 
 * @param {any} callback
 */
function updateArchiveList(callback) {
    if (updating) return;
    else updating = true;
    fs.readdir(archiveFloder, (err, files) => {
        let doneCnt = 0;
        allArchives = new Array();
        summaryList = new Array();
        files.forEach(fileName => {
            let tmpPath = path.resolve(archiveFloder, fileName);
            fs.readFile(tmpPath, (err, data) => {
                let str = data.toString();
                str = str.replace(/\r/g, '');
                let tmpArchive, tmpArchiveSummary;
                try {
                    tmpArchive = parseArchive(fileName, str);
                    tmpArchiveSummary = parseArchive(fileName, str, true);
                } catch (err) {
                    tmpArchive = new Archive('Error', { content: 'Parse Archive Failed.' });
                    tmpArchiveSummary = new Archive('Error', { content: 'Parse Archive Failed.' });
                }
                allArchives.push(tmpArchive);
                summaryList.push(tmpArchiveSummary);
                doneCnt++;
                if (doneCnt == files.length) {
                    summaryList.sort((a, b) => b.date - a.date);
                    callback && callback(summaryList);
                    updating = false;
                }
            });
        });
    });
}

/**
 * get all archives summary list
 * 
 * @param {any} callback
 */
function getSummaryList(callback) {
    if (!inited) throw new Error('Archive Reader Not inited yet.');
    fs.readdir(archiveFloder, (err, files) => {
        if (files.length > allArchives.length && files.length > summaryList.length) {
            updateArchiveList(() => callback && callback(summaryList));
        } else {
            callback && callback(summaryList);
        }
    });
}

/**
 * get all archives list
 * 
 * @param {any} callback
 */
function getArchiveList(callback) {
    if (!inited) throw new Error('Archive Reader Not inited yet.');
    fs.readdir(archiveFloder, (err, files) => {
        if (files.length > allArchives.length && files.length > summaryList.length)
            updateArchiveList();
        callback && callback(allArchives);
    });
}

/**
 * get archive Object by name or fileName.
 * 
 * @param {any} name
 * @param {any} callback
 */
function getDetail(name, callback) {
    if (!inited) throw new Error('Archive Reader Not inited yet.');
    let len = allArchives.length;
    for (let i = 0; i < len; i++) {
        let e = allArchives[i];
        if (e.title === name || e.fileName === name) {
            callback && callback(null, e);
            return;
        }
    }
    callback(new Error('Error: no such archive'), null);
}

module.exports = {
    init: init,
    parse: parseArchive,
    getSummaryList: getSummaryList,
    getArchiveList: getArchiveList,
    getDetail: getDetail,
    update: updateArchiveList,
    Archive: Archive
};