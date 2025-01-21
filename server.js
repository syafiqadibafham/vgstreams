import express from 'express'
const app = express()


async function fetchStreams () {
    const response = await fetch('https://ppv.land/api/streams')
    const streamData = await response.json()
    const nbaStreams= streamData.streams.find(element => element.id === 37);
    return nbaStreams;
}

async function getNameAndLink (nbaStreams) {
    let data = []
    for (const element of nbaStreams) {
        const response = await fetch("https://ppv.land/api/streams/" + element.id)
        const jsonData = await response.json()
        const elementData = jsonData["data"]
        let addElement = {
            "name": null,
            "link": null,
            "id": null,
            "thumbnail": null,
        }
        addElement["id"] = (elementData.id)
        addElement["link"] = (elementData["m3u8"])
        addElement["name"] = (elementData.name)
        addElement["thumbnail"] = (elementData.poster)
        data.push(addElement)
    };
    return data;
}

async function getNBAData () {
    const streamData = await fetchStreams()
    const nbaData = await getNameAndLink(streamData.streams)
    return nbaData;
}

app.get('/', async function(req,res) {
    const nbaData = await getNBAData()
    res.send(nbaData)
})

app.listen(3001)


