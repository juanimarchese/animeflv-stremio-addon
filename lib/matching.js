//Rules used to find an addon-less ID's show (Cinemeta, Kitsu...) among a site's search results.
const fuzzysort = require("fuzzysort")

//Search terms in order: romaji title first (what the sites use), then the provider's title; seasons > 1 are appended
exports.BuildSearchTerms = function (romaji, title, season) {
  return [...new Set([romaji, title].filter(Boolean))].map((t) => ((season) && (parseInt(season) !== 1) && (parseInt(season) !== 0)) ? `${t} ${season}` : t)
}

//Regular-season episodes must not match a site's separate "Specials"/OVA entry (issue #55)
exports.IsSpecial = (title) => /\b(specials?|especial(es)?|ova)\b/i.test(title)

//Henaojara lists every season, movie, special and dub as its own entry, so titles must match once
//dub/quality tags and the words "season"/"temporada" are ignored
exports.NormalizeHenaojaraTitle = (title) => title.toLowerCase().replace(/\b(latino|castellano|1080p|season|temporada)\b/g, "").replace(/[^a-z0-9]/g, "")

//Runs searchFn with each term until one succeeds
exports.FirstMatch = (searchTerms, searchFn) => searchTerms.reduce((prev, searchTerm) => prev.catch(() => searchFn(searchTerm)), Promise.reject(Error('No search terms!')))

//Finds a show on the first source that has it and returns that source's meta, so anime IDs (AniList, MAL...)
//get a native meta whose videos have streams. sources: [{ name, search(term), meta(slug) }], tried in order
exports.FindNativeMeta = async function (searchTerms, sources) {
  for (const src of sources) {
    try {
      return await exports.FirstMatch(searchTerms, (term) => src.search(term).then((items) => {
        //a special is only a match when a special was asked for
        const candidates = items.filter((i) => exports.IsSpecial(i.title) === exports.IsSpecial(term))
        const result = fuzzysort.go(term, candidates, { key: "title", limit: 1, threshold: .5 })[0]?.obj
        if (!result) throw Error("No search results!")
        console.log(`\x1b[36mGot ${src.name} entry:\x1b[39m`, result.title)
        return src.meta(result.slug)
      }))
    } catch (err) {
      console.error(`\x1b[31mNo ${src.name} match because:\x1b[39m ${err}`)
    }
  }
  throw Error("Not found on any source")
}
