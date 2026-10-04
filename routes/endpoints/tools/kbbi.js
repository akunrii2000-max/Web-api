'use strict';

const { Router } = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const FormData   = require('form-data');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse } = require('../../../config/apikeyConfig');

const router = Router();

class KBBIClient {
    async login() {
        const { data, headers } = await axios.get('https://kbbi.kemendikdasmen.go.id/Account/Login');
        const $ = cheerio.load(data);
        const form = new FormData();
        form.append('__RequestVerificationToken', $('input[name="__RequestVerificationToken"]').attr('value'));
        form.append('Posel', 'rynekoo@usako.net');
        form.append('KataSandi', 'Rynekoo2009');
        form.append('IngatSaya', 'true');
        const { headers: head } = await axios.post('https://kbbi.kemendikdasmen.go.id/Account/Login', form, { headers: { cookie: headers['set-cookie'].join('; '), ...form.getHeaders() }, maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
        return head['set-cookie'].join('; ');
    }
    async search(word) {
        if (!word) throw new ValidationError('Parameter "word" wajib diisi.');
        const cookies = await this.login();
        const { data } = await axios.get(`https://kbbi.kemendikdasmen.go.id/entri/${word}`, { headers: { cookie: cookies } });
        const $ = cheerio.load(data);
        const allHomographs = [];
        $('h2[style*=\'margin-bottom:3px\']').each((_, element) => {
            const $h2 = $(element).clone();
            const $ns = $h2.find('small:contains(\'bentuk tidak baku:\')');
            let kataTidakBaku = null;
            if ($ns.length > 0) { kataTidakBaku = $ns.find('b').text().trim(); $ns.remove(); }
            const wordKey = $h2.text().trim().replace(/(\d+)/g, '^$1');
            const entryDetails = { makna: [], kata_tidak_baku: kataTidakBaku, kata_turunan: [], gabungan_kata: [] };
            const meaningList = $(element).nextAll('ul.adjusted-par, ol.last-list-child').first();
            if (meaningList.length > 0) {
                meaningList.find('li').each((i, li) => {
                    const $li = $(li).clone();
                    const kelas_kata = $li.find('span[title]').attr('title');
                    $li.find('font[color=\'red\'] > i > span[title]').closest('font').remove();
                    $li.find('span.entrisButton').remove();
                    const deskripsi = cheerio.load($li.html() || '').text().trim().replace(/\s+/g, ' ');
                    if (kelas_kata && deskripsi) entryDetails.makna.push({ kelas_kata, deskripsi });
                });
            }
            allHomographs.push({ [wordKey]: entryDetails });
        });
        let peribahasa = [], idiom = [];
        $(`h4:contains('Peribahasa')`).filter((i, el) => $(el).text().includes(`(mengandung [${word}])`)).last().nextAll('ul.adjusted-par').first().find('li a').each((i, el) => { peribahasa.push($(el).text().trim()); });
        $(`h4:contains('Idiom')`).filter((i, el) => $(el).text().includes(`(mengandung [${word}])`)).last().nextAll('ul.adjusted-par').first().find('li a').each((i, el) => { idiom.push($(el).text().trim()); });
        return { kata: allHomographs, peribahasa, idiom };
    }
}
const kbbi = new KBBIClient();

router.get('/api/tools/kbbi', asyncHandler(async (req, res) => { sendSuccessResponse(res, await kbbi.search(req.query.word)); }));
router.post('/api/tools/kbbi', asyncHandler(async (req, res) => { sendSuccessResponse(res, await kbbi.search(req.body.word)); }));

router.metadata = [
    { name: 'KBBI', path: '/api/tools/kbbi', methods: ['GET', 'POST'], category: 'TOOLS', description: 'Cari kata di Kamus Besar Bahasa Indonesia (KBBI).', params: [{ name: 'word', type: 'string', required: true }] },
];

module.exports = router;
