'use strict';

const { Router } = require('express');
const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

function generateFunFacts(birthDate) {
  const birth = new Date(birthDate);
  const now = new Date();

  if (isNaN(birth.getTime())) {
    throw new ValidationError("Invalid date format. Use YYYY-MM-DD format", 400);
  }

  if (birth > now) {
    throw new ValidationError("Birth date cannot be in the future", 400);
  }

  const timeDiff = now - birth;
  const ageInSeconds = Math.floor(timeDiff / 1000);
  const ageInMinutes = Math.floor(ageInSeconds / 60);
  const ageInHours = Math.floor(ageInMinutes / 60);
  const ageInDays = Math.floor(ageInHours / 24);
  const ageInWeeks = Math.floor(ageInDays / 7);
  const ageInMonths = Math.floor(ageInDays / 30.44);
  const ageInYears = Math.floor(ageInDays / 365.25);

  return {
    birthDate: birth.toISOString().split("T")[0],
    calculatedAt: now.toISOString(),
    basicInfo: {
      ageInYears,
      ageInMonths,
      ageInWeeks,
      ageInDays,
      ageInHours,
      ageInMinutes,
      ageInSeconds,
    },
    respiratory: {
      totalBreaths: Math.round(ageInMinutes * 15),
      totalAirVolumeL: Math.round(ageInMinutes * 15 * 0.5),
      oxygenConsumedL: Math.round(ageInMinutes * 250 / 1000),
      co2ProducedL: Math.round(ageInMinutes * 200 / 1000),
    },
    cardiovascular: {
      heartBeatsTotal: Math.round(ageInMinutes * 70),
      bloodPumpedL: Math.round(ageInMinutes * 4.9),
      strokeVolumeTotal: Math.round(ageInMinutes * 70 * 70 / 1000),
      bloodDistanceKM: Math.round(ageInDays * 19.3),
    },
    neurological: {
      actionPotentials: Math.round(ageInSeconds * 200000000),
      synapticTransmissions: Math.round(ageInSeconds * 50000000000),
      brainEnergyConsumedKJ: Math.round(ageInDays * 1728),
    },
    digestive: {
      salivaProducedL: Math.round(ageInDays * 1.5),
      gastricJuiceProducedL: Math.round(ageInDays * 2.5),
      bileProducedL: Math.round(ageInDays * 0.5),
      peristalticWaves: Math.round(ageInHours * 3),
    },
    renal: {
      bloodFilteredL: Math.round(ageInMinutes * 1.2),
      urineProducedL: Math.round(ageInDays * 1.5),
      glomerularFiltrateL: Math.round(ageInMinutes * 0.12),
    },
    immuneSystem: {
      whiteCellsProduced: Math.round(ageInDays * 7142857),
      antibodiesGenerated: Math.round(ageInDays * 1000000),
      pathogensEliminated: Math.round(ageInDays * 100000),
    },
    cellularActivity: {
      cellsReplaced: Math.round(ageInDays * 300000000000),
      proteinsProducedKG: Math.round(ageInDays * 0.4),
      dnaRepairOperations: Math.round(ageInDays * 37200),
    },
    sensory: {
      eyeBlinks: Math.round(ageInMinutes * 20),
      eyeMovements: Math.round(ageInDays * 100000),
      soundsProcessed: Math.round(ageInSeconds * 1000),
    },
    endocrineSystem: {
      hormonalPulses: Math.round(ageInDays * 50),
      insulinSecretions: Math.round(ageInDays * 40),
      cortisolReleases: Math.round(ageInDays),
    },
    musculoskeletal: {
      muscleContractions: Math.round(ageInDays * 100000),
      boneRemodelingCycles: Math.round(ageInDays * 200),
      jointMovements: Math.round(ageInDays * 50000),
    },
    metabolicSummary: {
      totalCaloriesBurned: Math.round(ageInDays * 2000),
      waterProcessedL: Math.round(ageInDays * 35),
      oxygenConsumedL: Math.round(ageInMinutes * 250 / 1000),
      energyProducedKJ: Math.round(ageInDays * 8400),
    },
    amazingFacts: {
      totalBodyCells: 37200000000000,
      totalDnaLengthKM: Math.round(37200000000000 * 0.0018 / 1000),
      neuronConnections: 100000000000000,
      bloodVesselLengthKM: 100000,
      boneStrengthPSI: 19000,
    },
  };
}

router.get("/api/fun/livefunfact", asyncHandler(async (req, res) => {
  const { birthdate } = req.query;

  if (!birthdate) {
    throw new ValidationError("birthdate parameter is required", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    throw new ValidationError("birthdate must be in YYYY-MM-DD format", 400);
  }

  const result = generateFunFacts(birthdate);

  sendSuccessResponse(res, result);
}));

router.post("/api/fun/livefunfact", asyncHandler(async (req, res) => {
  const { birthdate } = req.body;

  if (!birthdate) {
    throw new ValidationError("birthdate parameter is required", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    throw new ValidationError("birthdate must be in YYYY-MM-DD format", 400);
  }

  const result = generateFunFacts(birthdate);

  sendSuccessResponse(res, result);
}));

router.metadata = {
  name: "Live Fun Facts About You",
  path: "/api/fun/livefunfact",
  methods: ['GET', 'POST'],
  category: "FUN",
  description: "Generate fun medical facts about the human body based on birth date. Returns statistics from various body systems including respiratory, cardiovascular, neurological, digestive, and more.",
  params: [
    {
      name: "birthdate",
      type: "text",
      required: true,
      placeholder: "1990-05-15",
      description: "Birth date in YYYY-MM-DD format",
    },
  ],
};

module.exports = router;