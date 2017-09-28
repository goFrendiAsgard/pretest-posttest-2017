let async = require('async')
let clone = require('clone')
let fs = require('fs')

let GROUPS = ['MI', 'SI', 'TI A', 'TI B', 'TI C', 'TI D', 'TI E']

function max(arr){
    let n = null
    for(data of arr){
        if(n == null){
            n = data
        }
        else if(data > n){
            n = data
        }
    }
    return n
}

function min(arr){
    let n = null
    for(data of arr){
        if(n == null){
            n = data
        }
        else if(data < n){
            n = data
        }
    }
    return n
}

function sum(arr){
    let n = 0 
    for(data of arr){
        n+= data
    }
    return n
}

function avg(arr){
    return sum(arr)/arr.length
}

function stdev(arr){
    let mean = avg(arr)
    let total = 0 
    for(data of arr){
        total = Math.pow(data-mean, 2)
    }
    return Math.pow(total/(arr.length-1), 0.5)
}

function stat(arr){
    return {
        'min' : min(arr),
        'max' : max(arr),
        'avg' : avg(arr),
        'sum' : sum(arr),
        'stdev' : stdev(arr),
    }
}

function preprocessNrp(nrp){
    nrp = nrp.trim()
    nrp = nrp.replace(/ /g, '')
    nrp = nrp.replace(/"/g, '')
    nrp = nrp.replace(/-/g, '')
    nrp = nrp.replace(/\./g, '')
    nrp = nrp.toUpperCase()
    return nrp
}

function preprocessNama(nama){
    nama = nama.trim()
    nama = nama.replace(/"/g, '')
    nama = nama.replace(/-/g, '')
    nama = nama.toUpperCase()
    return nama
}

function preprocessScore(score){
    score = score.trim()
    score = score.replace(/"/g, '')
    score = score.split('/')[0]
    score = score.trim()
    return parseFloat(score)
}

function generateRandomNrp(){
    return '@' + String(Math.random())
}

function getImportantData(fileName, callback){
    fs.readFile(fileName, function(error, content){
        let newContent = []
        if(!error){
            content = String(content)
            content = content.split('\n') 
            for(let rowIndex = 1; rowIndex<content.length; rowIndex++){
                let row = content[rowIndex]
                row = row.split(',')
                let score = preprocessScore(row[1])
                let nama = preprocessNama(row[2])
                let nrp = preprocessNrp(row[3])
                newContent.push({'nrp':nrp, 'nama':nama, 'score':score})
            }
        }
        callback(error, newContent)
    })
}

function ilanginSpasi(str){
    return str.replace(/ /g, '')
}

let DATASET = {}
let actions = []
for(let group of GROUPS){
    // tambahkan aksi untuk baca pretest
    actions.push((callback) => {
        DATASET[group] = {}
        // baca hasil pretest
        getImportantData('Soal Pre Test '+group+'.csv', function(error, content){
            for(let row of content){
                let nrp = row.nrp
                let nama = row.nama
                let score = row.score
                if(nrp == ''){
                    nrp = generateRandomNrp()
                }
                DATASET[group][nrp] = {
                    'nama':nama, 
                    'pretest':score, 
                    'ikutPretest':true, 
                    'posttest':0, 
                    'ikutPosttest':false,
                    'kenaikan' : -score,
                }
            }
            callback()
        })
    })
    // tambahkan aksi untuk baca posttest
    actions.push((callback) => {
        // baca hasil posttest
        getImportantData('Soal Post Test '+group+'.csv', function(error, content){
            for(let row of content){
                let nrp = row.nrp
                let nama = row.nama
                let score = row.score
                // buat anak-anak susah yang waktu pretest ga tau nrp, waktu posttest baru tahu
                if(!(nrp in DATASET[group])){
                    for(nrpSearch in DATASET[group]){
                        let rowSearch = DATASET[group][nrpSearch]
                        let namaSama = ilanginSpasi(rowSearch['nama']) == ilanginSpasi(nama)
                        if(nrpSearch.match(/^@.*/g) && namaSama){
                            DATASET[group][nrp] = rowSearch
                            delete DATASET[group][nrpSearch]
                        }
                    }
                    if(!(nrp in DATASET[group]) && nrp != ''){
                        DATASET[group][nrp] = {'nama':nama, 'pretest':0, 'ikutPretest':false}
                    }
                }
                // buat anak-anak goblok kakean micin yang waktu pretest udah tahu NRP nya, tapi waktu post test ga ditulis 
                // semoga kepalanya di sleding satu-satu sama Kak Seto Kaiba
                if(nrp == ''){
                    for(nrpSearch in DATASET[group]){
                        let rowSearch = DATASET[group][nrpSearch]
                        if(ilanginSpasi(rowSearch['nama']) == ilanginSpasi(nama)){
                            nrp = nrpSearch
                            break
                        }
                    }
                }
                if(nrp == ''){
                    nrp = generateRandomNrp()
                    DATASET[group][nrp] = {'nama':nama, 'pretest':0, 'ikutPretest':false}
                }
                DATASET[group][nrp]['posttest'] = score
                DATASET[group][nrp]['ikutPosttest'] = true
                DATASET[group][nrp]['kenaikan'] = DATASET[group][nrp]['posttest'] - DATASET[group][nrp]['pretest']
            }
            callback()
        })
    })
}

// create JSON file
actions.push((callback) => {
    let content = {}
    for(let group in DATASET){
        let data = DATASET[group]
        let pretest = []
        let posttest = []
        let kenaikan = []
        for(nrp in data){
            let row = data[nrp]
            pretest.push(row.pretest)
            posttest.push(row.posttest)
            kenaikan.push(row.kenaikan)
        }
        content[group] = {'data': data, 'pretest': stat(pretest), 'posttest': stat(posttest), 'kenaikan': stat(kenaikan)}
    }
    content = JSON.stringify(content, null, 4)
    fs.writeFile('rekap.json', content, function(error){
        callback()
    })
})

// tambahkan aksi untuk merekap
actions.push((callback) => {
    let csv = []
    for(group in DATASET){
        for(nrp in DATASET[group]){
            let row = DATASET[group][nrp]
            let csvRow = [group, nrp, row.nama, row.pretest, row.posttest, row.kenaikan, row.ikutPretest, row.ikutPosttest]
            csv.push(csvRow.join(','))
        }
    }
    csv = csv.join('\n')
    fs.writeFile('rekap.csv', csv, function(error){
        console.log('Done....')
        callback()
    })
})

// do nothing, just do the actions
async.series(actions, (error, result)=>{})
