'use strict';

const { Router } = require('express');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const cartoonData = [
  { name: "Tom and Jerry", img: "https://i.pinimg.com/736x/c2/f0/97/c2f0975cc0cb2985e359abce2461e986.jpg" },
  { name: "Mickey Mouse", img: "https://i.pinimg.com/736x/9e/bc/77/9ebc77ae4c7dca6ec3f342958d7b2cae.jpg" },
  { name: "Donald Duck", img: "https://i.pinimg.com/736x/6e/a7/d4/6ea7d415f9b6abe951fb1b43dc1e094f.jpg" },
  { name: "Scooby Doo", img: "https://i.pinimg.com/736x/68/76/fb/6876fb80983d8a780977c351fe65c54c.jpg" },
  { name: "The Flintstones", img: "https://i.pinimg.com/736x/3d/24/16/3d2416dbde61723402736548b72bd99b.jpg" },
  { name: "Popeye", img: "https://i.pinimg.com/736x/dc/48/a3/dc48a378fb3a86b744a0229d9ba36127.jpg" },
  { name: "SpongeBob SquarePants", img: "https://i.pinimg.com/736x/d2/b2/49/d2b2493f88da017b20b2f5ae1ad6be86.jpg" },
  { name: "Dora the Explorer", img: "https://i.pinimg.com/736x/35/a0/02/35a0020ad541c8d1d6428e119b523560.jpg" },
  { name: "Ben 10", img: "https://i.pinimg.com/736x/8a/f4/52/8af45205d34223f47b51f14edffce4e5.jpg" },
  { name: "Teenage Mutant Ninja Turtles", img: "https://i.pinimg.com/736x/59/72/c4/5972c4fd49d8343cb0d27201d5d861c0.jpg" },
  { name: "The Pink Panther", img: "https://i.pinimg.com/736x/4c/35/a1/4c35a178ac9b02dd3f5c64142ec8cb54.jpg" },
  { name: "Bugs Bunny", img: "https://i.pinimg.com/736x/8e/4c/16/8e4c16d699ca1b53ef3b8e935a9e1034.jpg" },
  { name: "Tweety", img: "https://i.pinimg.com/736x/e6/10/dc/e610dcb4430927c1d4f3b4a1e8476f14.jpg" },
  { name: "Sylvester", img: "https://i.pinimg.com/736x/0b/c0/7a/0bc07a3334a40578adecaadb829dcee2.jpg" },
  { name: "Daffy Duck", img: "https://i.pinimg.com/736x/21/71/b8/2171b82513f2ef7001ab9b83123c933e.jpg" },
  { name: "Porky Pig", img: "https://i.pinimg.com/736x/88/69/b4/8869b464d10c872572beeca9d33e4bea.jpg" },
  { name: "Woody Woodpecker", img: "https://i.pinimg.com/736x/ce/32/7c/ce327cb85461b3a3db2a6d8e9a95f442.jpg" },
  { name: "Road Runner", img: "https://i.pinimg.com/736x/d3/c1/d0/d3c1d05709d6cf2e3529271a3cbdeb23.jpg" },
  { name: "Wile E. Coyote", img: "https://i.pinimg.com/736x/56/4e/58/564e58e5d13c2664cf7c6ae3cb808ffa.jpg" },
  { name: "Garfield", img: "https://i.pinimg.com/736x/85/9f/09/859f09faf16470f5b10dc4480190fbbf.jpg" },
];

router.get("/api/games/tebakkartun", asyncHandler(async (req, res) => {
  const randomCartoon = cartoonData[Math.floor(Math.random() * cartoonData.length)];
  sendSuccessResponse(res, randomCartoon);
}));

router.post("/api/games/tebakkartun", asyncHandler(async (req, res) => {
  const randomCartoon = cartoonData[Math.floor(Math.random() * cartoonData.length)];
  sendSuccessResponse(res, randomCartoon);
}));

router.metadata = [
  {
    name: "Tebak Kartun (GET)",
    path: "/api/games/tebakkartun",
    methods: ['GET'],
    category: "GAMES",
    description: "Get a random cartoon guessing game with cartoon image and name.",
    params: [
    ],
  },
  {
    name: "Tebak Kartun (POST)",
    path: "/api/games/tebakkartun",
    methods: ['POST'],
    category: "GAMES",
    description: "Get a random cartoon guessing game via POST.",
    params: [
    ],
  },
];

module.exports = router;