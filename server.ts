import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Initialize Gemini SDK with User-Agent header as required
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 2. Global Integrations Status Check (Gemini, Google Maps, Planet)
app.get("/api/integrations/status", (_req, res) => {
  res.json({
    gemini: {
      available: !!process.env.GEMINI_API_KEY,
      model: "gemini-3.8-flash",
    },
    googleMaps: {
      available: !!process.env.GMAPS_API,
    },
    planet: {
      available: !!process.env.PLANET_API,
    },
  });
});

// 3. Gemini Status check
app.get("/api/gemini/status", (_req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    available: hasKey,
    model: "gemini-3.8-flash",
    message: hasKey
      ? "Gemini API key is active and ready."
      : "GEMINI_API_KEY is not configured in Secrets.",
  });
});

// 4. Google Maps Platform Config & Proxy
app.get("/api/maps/config", (_req, res) => {
  const apiKey = process.env.GMAPS_API || "";
  res.json({
    available: !!apiKey,
    apiKey,
    attributionId: "gmp_git_agentskills_v1",
  });
});

app.get("/api/maps/geocode", async (req, res) => {
  const query = req.query.q as string;
  const apiKey = process.env.GMAPS_API;
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  // If Google Maps key is available, attempt it first
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "OK" && data.results?.length > 0) {
        return res.json(data);
      }
    } catch (err: any) {
      console.warn("Google geocoding error:", err?.message);
    }
  }

  // Fallback to OpenStreetMap Nominatim
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
    const nomResp = await fetch(nomUrl, {
      headers: {
        "User-Agent": "RoadSenseAI/1.0 (Infrastructure Road Safety Assessment; contact@roadsense.ai)",
        "Accept-Language": "en",
      },
    });
    if (nomResp.ok) {
      const nomData = await nomResp.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        return res.json({
          status: "OK",
          results: nomData.map((item: any) => ({
            formatted_address: item.display_name,
            geometry: {
              location: {
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              },
            },
            address_components: [
              {
                long_name: item.name || item.display_name.split(",")[0],
                types: ["locality"],
              },
            ],
            source: "nominatim",
          })),
        });
      }
    }
  } catch (err: any) {
    console.warn("Nominatim fallback failed:", err?.message);
  }

  res.json({ status: "ZERO_RESULTS", results: [] });
});

// Universal Geocode Endpoint (supports names, addresses, coordinates)
app.get("/api/geocode", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  // 1. Check for coordinates format e.g. "17.3850, 78.4867" or "17.3850 78.4867"
  const coordMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return res.json({
        status: "OK",
        results: [
          {
            formatted_address: `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            name: `Coordinates [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
            city: `Lat ${lat.toFixed(2)}`,
            country: `Lng ${lng.toFixed(2)}`,
            lat,
            lng,
            source: "direct_coordinates",
          },
        ],
      });
    }
  }

  // 2. Google Maps Geocoding if key configured
  const apiKey = process.env.GMAPS_API;
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "OK" && data.results?.length > 0) {
        const results = data.results.map((r: any) => {
          const localityComp = r.address_components?.find((c: any) =>
            c.types.includes("locality") || c.types.includes("administrative_area_level_1")
          );
          const countryComp = r.address_components?.find((c: any) => c.types.includes("country"));
          return {
            formatted_address: r.formatted_address,
            name: r.address_components?.[0]?.long_name || r.formatted_address.split(",")[0],
            city: localityComp?.long_name || "",
            country: countryComp?.long_name || "",
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            source: "google_maps",
          };
        });
        return res.json({ status: "OK", results });
      }
    } catch (err: any) {
      console.warn("Google geocoding error:", err?.message);
    }
  }

  // 3. Fallback: OpenStreetMap Nominatim (Global coverage, no API key required)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
    const nomResp = await fetch(nomUrl, {
      headers: {
        "User-Agent": "RoadSenseAI/1.0 (Road Infrastructure Safety Assessment; contact@roadsense.ai)",
        "Accept-Language": "en",
      },
    });
    if (nomResp.ok) {
      const nomData = await nomResp.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const results = nomData.map((item: any) => {
          const city =
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.municipality ||
            item.address?.county ||
            "";
          const country = item.address?.country || "";
          return {
            formatted_address: item.display_name,
            name: item.name || item.display_name.split(",")[0],
            city,
            country,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            source: "nominatim",
          };
        });
        return res.json({ status: "OK", results });
      }
    }
  } catch (err: any) {
    console.error("Nominatim search error:", err?.message);
  }

  res.json({ status: "ZERO_RESULTS", results: [] });
});

// Reverse Geocoding
app.get("/api/geocode/reverse", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "Valid numeric lat and lng are required." });
  }

  const apiKey = process.env.GMAPS_API;
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "OK" && data.results?.[0]) {
        const r = data.results[0];
        const locality = r.address_components?.find((c: any) =>
          c.types.includes("locality") || c.types.includes("administrative_area_level_1")
        );
        const country = r.address_components?.find((c: any) => c.types.includes("country"));
        return res.json({
          status: "OK",
          formatted_address: r.formatted_address,
          name: r.address_components?.[0]?.long_name || r.formatted_address.split(",")[0],
          city: locality?.long_name || "",
          country: country?.long_name || "",
        });
      }
    } catch {}
  }

  // Fallback to Nominatim Reverse
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const nomResp = await fetch(nomUrl, {
      headers: {
        "User-Agent": "RoadSenseAI/1.0 (Road Infrastructure Safety Assessment; contact@roadsense.ai)",
        "Accept-Language": "en",
      },
    });
    if (nomResp.ok) {
      const data = await nomResp.json();
      return res.json({
        status: "OK",
        formatted_address: data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        name:
          data.name ||
          data.address?.road ||
          data.address?.suburb ||
          data.address?.neighbourhood ||
          data.address?.city ||
          `Corridor [${lat.toFixed(3)}, ${lng.toFixed(3)}]`,
        city: data.address?.city || data.address?.town || data.address?.state || "",
        country: data.address?.country || "",
      });
    }
  } catch {}

  res.json({
    status: "OK",
    formatted_address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    name: `Corridor [${lat.toFixed(3)}, ${lng.toFixed(3)}]`,
    city: "",
    country: "",
  });
});

// Server-side Overpass API proxy to bypass browser CORS / network restrictions
app.post("/api/osm/overpass", async (req, res) => {
  const { queryQL } = req.body;
  if (!queryQL) {
    return res.status(400).json({ error: "queryQL is required." });
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(queryQL)}`,
      });
      if (resp.ok) {
        const data = await resp.json();
        return res.json(data);
      }
    } catch {}
  }

  res.status(502).json({ error: "Overpass API unreachable" });
});

app.get("/api/maps/streetview/metadata", async (req, res) => {
  const lat = req.query.lat as string;
  const lng = req.query.lng as string;
  const apiKey = process.env.GMAPS_API;
  if (!apiKey) {
    return res.status(400).json({ error: "Google Maps API key not configured." });
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Street View metadata check failed." });
  }
});

// 5. Planet Labs Satellite API Endpoints
app.get("/api/planet/status", async (_req, res) => {
  const apiKey = process.env.PLANET_API;
  if (!apiKey) {
    return res.json({
      available: false,
      message: "PLANET_API is not configured in Secrets.",
    });
  }
  try {
    const auth = Buffer.from(apiKey + ":").toString("base64");
    const resp = await fetch("https://api.planet.com/data/v1/item-types", {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      return res.json({
        available: true,
        itemTypes: data.item_types?.map((it: any) => it.id) || ["PSScene", "SkySatScene"],
        message: "Planet API is active and authorized.",
      });
    } else {
      return res.json({
        available: false,
        message: `Planet API returned HTTP ${resp.status}`,
      });
    }
  } catch (err: any) {
    return res.json({
      available: false,
      message: err?.message || "Failed to reach Planet API",
    });
  }
});

app.post("/api/planet/search", async (req, res) => {
  const apiKey = process.env.PLANET_API;
  if (!apiKey) {
    return res.status(400).json({ error: "PLANET_API is not configured in Secrets." });
  }

  const { lat, lng, radiusKm = 1.5, maxCloudCover = 0.25, itemTypes = ["PSScene"] } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "Numeric lat and lng are required." });
  }

  // Calculate polygon bounding box in degrees (~0.009 deg per km latitude)
  const dLat = (radiusKm / 111) * 1.2;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = (radiusKm / (111 * (Math.abs(cosLat) > 0.001 ? cosLat : 1))) * 1.2;

  const polygonCoords = [
    [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ],
  ];

  const searchPayload = {
    item_types: itemTypes,
    filter: {
      type: "AndFilter",
      config: [
        {
          type: "GeometryFilter",
          field_name: "geometry",
          config: {
            type: "Polygon",
            coordinates: polygonCoords,
          },
        },
        {
          type: "RangeFilter",
          field_name: "cloud_cover",
          config: { lte: maxCloudCover },
        },
      ],
    },
  };

  try {
    const auth = Buffer.from(apiKey + ":").toString("base64");
    const resp = await fetch("https://api.planet.com/data/v1/quick-search", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchPayload),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return res.status(resp.status).json({ error: `Planet API error: ${errBody}` });
    }

    const data = await resp.json();
    const features = (data.features || []).slice(0, 30).map((f: any) => ({
      id: f.id,
      itemType: f.properties?.item_type || "PSScene",
      acquired: f.properties?.acquired,
      cloudCover: Math.round((f.properties?.cloud_cover || 0) * 100),
      sunElevation: Math.round(f.properties?.sun_elevation || 0),
      groundSampleDistance: f.properties?.gsd || 3.0,
      instrument: f.properties?.instrument || "Dove PSB",
      satelliteId: f.properties?.satellite_id || "PlanetScope",
      thumbnailUrl: `/api/planet/thumbnail/${f.properties?.item_type || "PSScene"}/${f.id}`,
    }));

    res.json({
      success: true,
      count: features.length,
      features,
      boundingBox: {
        minLat: lat - dLat,
        maxLat: lat + dLat,
        minLng: lng - dLng,
        maxLng: lng + dLng,
      },
    });
  } catch (err: any) {
    console.error("Planet search error:", err);
    res.status(500).json({ error: err?.message || "Failed to search Planet satellite imagery." });
  }
});

app.get("/api/planet/thumbnail/:itemType/:itemId", async (req, res) => {
  const apiKey = process.env.PLANET_API;
  if (!apiKey) {
    return res.status(400).send("PLANET_API not set");
  }

  const { itemType, itemId } = req.params;
  const auth = Buffer.from(apiKey + ":").toString("base64");
  const thumbUrl = `https://tiles.planet.com/data/v1/item-types/${itemType}/items/${itemId}/thumb`;

  try {
    const thumbResp = await fetch(thumbUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!thumbResp.ok) {
      return res.status(thumbResp.status).send("Thumbnail not available");
    }

    const contentType = thumbResp.headers.get("content-type") || "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const arrayBuffer = await thumbResp.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    res.status(500).send("Error fetching Planet thumbnail");
  }
});

// 3. Multi-Modal Road Risk Audit & Municipal Action Plan
app.post("/api/gemini/audit-report", async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured in Secrets. Please verify your secrets in AI Studio Settings.",
      });
    }

    const { road, corridor, weights } = req.body;

    const prompt = `You are the Chief Geospatial Civil Engineer & Infrastructure Safety Auditor for RoadSense AI.
Analyze the following multi-modal road corridor and segment data, fusing OpenStreetMap infrastructure tags, satellite U-Net segmentation, temporal change detection, and ground-level computer vision defect detection.

--- GEOSPATIAL CORRIDOR CONTEXT ---
Location: ${corridor?.name || "Urban Corridor"}, ${corridor?.city || ""}, ${corridor?.country || ""}
Coordinates: [${corridor?.lat || 0}, ${corridor?.lng || 0}], Radius: ${corridor?.radiusKm || 1} km
Satellite Baseline Date (T1): ${corridor?.satellite?.t1Date || "2024-03"}
Satellite Current Date (T2): ${corridor?.satellite?.t2Date || "2026-02"}
Satellite Temporal Change Detected: ${corridor?.satellite?.changeDetectedPct || 0}%
U-Net Road Mask IoU: ${corridor?.satellite?.segmentationIoU || 0.88}

--- SPECIFIC ROAD SEGMENT TELEMETRY ---
Segment Name: ${road?.name || "Selected Corridor Segment"}
OSM Way ID: ${road?.osmWayId || "N/A"}
Highway Classification: ${road?.osm?.highwayType || "secondary"}
Lanes: ${road?.osm?.lanes || 2}, Declared Surface: ${road?.osm?.surfaceDeclared || "asphalt"}
Speed Limit: ${road?.osm?.speedLimitKmh || 50} km/h
Infrastructure Deficits:
- Sidewalk: ${road?.osm?.hasSidewalk ? road?.osm?.sidewalkType : "NONE (Pedestrian Exposure)"}
- Pedestrian Crossing: ${road?.osm?.hasCrossing ? "Present" : "ABSENT"}
- Night Illumination (Lighting): ${road?.osm?.isLit ? "Equipped" : "UNLIT / DARK"}
- Traffic Signal: ${road?.osm?.hasTrafficSignal ? "Present" : "Uncontrolled"}

Ground Vision Defect Metrics:
- Potholes Detected: ${road?.potholeCount ?? 0}
- Severe Cracking Distress: ${road?.crackCount ?? 0}
- Surface Condition Class: ${road?.surfaceCondition || "moderate"}
- Defect Score: ${road?.defectScore ?? 40}/100

Temporal Change & Geometry:
- Road Width Detected vs OSM: ${road?.widthMeters || 7}m (Deviation: ${road?.widthChanged ? "Constricted/Encroached" : "Nominal"})
- Change Score: ${road?.changeScore ?? 35}/100

FUSED COMPOSITE RISK SCORE:
- Risk Score: ${road?.overallRisk ?? 65} / 100 [Level: ${road?.riskLevel || "HIGH"}]
- Weights Applied: Ground Defects (${weights?.defectWeight ?? 0.3}), Surface (${weights?.surfaceWeight ?? 0.2}), Satellite Change (${weights?.changeWeight ?? 0.2}), Infrastructure Deficits (${weights?.infrastructureWeight ?? 0.15}), Geometry Constriction (${weights?.geometryWeight ?? 0.15})

--- REQUIRED AUDIT STRUCTURE ---
Generate a rigorous, professional engineering synthesis in clean markdown format:
1. **Executive Safety Diagnosis**: Concise summary of why this corridor segment received this risk score.
2. **Multi-Modal Root Cause Analysis**: Explain how satellite temporal degradation, ground potholes/cracks, and missing OSM safety infrastructure (sidewalks/lighting) compound the hazard.
3. **Vulnerable Road User (VRU) Impact**: Specific collision and injury risks for two-wheelers/bicycles, pedestrians, and transit vehicles.
4. **Prioritized Municipal Action Plan**:
   - **Tier 1 (Immediate 0-14 Days)**: Emergency safety measures and rapid patching.
   - **Tier 2 (Mid-Term 30-90 Days)**: Resurfacing, sealing, or drainage rectification.
   - **Tier 3 (Capital Investment 6-12 Months)**: Structural rehabilitation, pedestrian sidewalks, illumination retrofits.
5. **Engineering Specifications & Material Guidance**: Specific materials (e.g. SMA asphalt, tack coats, elastomeric crack sealant) and expected service life extension.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text,
      timestamp: new Date().toISOString(),
      model: "gemini-3.8-flash",
    });
  } catch (err: any) {
    console.error("Gemini audit report error:", err);
    res.status(500).json({
      error: err?.message || "Failed to generate AI audit report.",
    });
  }
});

// 4. Ground Vision Defect & Damage Inspection
app.post("/api/gemini/analyze-defect", async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured in Secrets. Please verify your secrets in AI Studio Settings.",
      });
    }

    const { imageBase64, imageUrl, defectType, roadName } = req.body;

    let imagePart: { inlineData: { mimeType: string; data: string } } | null = null;

    if (imageBase64) {
      const mimeMatch = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const cleanData = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      imagePart = {
        inlineData: {
          mimeType,
          data: cleanData,
        },
      };
    } else if (imageUrl && imageUrl.startsWith("http")) {
      try {
        const fetchRes = await fetch(imageUrl);
        if (fetchRes.ok) {
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = fetchRes.headers.get("content-type") || "image/jpeg";
          imagePart = {
            inlineData: {
              mimeType,
              data: buffer.toString("base64"),
            },
          };
        }
      } catch (imgErr) {
        console.warn("Could not fetch remote image for Gemini, proceeding with textual prompt:", imgErr);
      }
    }

    const promptText = `You are the Senior Pavement Distress & Computer Vision Specialist at RoadSense AI.
Analyze this ground-level road inspection photograph${roadName ? ` taken along "${roadName}"` : ""}.
Distress category hint: ${defectType || "pothole and pavement cracking"}.

Conduct a rigorous ASTM D6433 / AASHTO pavement condition evaluation:
1. **Pavement Distress Identification**:
   - Classify all visible distress mechanisms (e.g. Alligator/Fatigue cracking, Pothole depth/diameter, Edge spalling, Ravelling, Longitudinal joint separation, Water ponding).
2. **Severity Classification & PCI Impact**:
   - Pavement Condition Index (PCI) deduction estimate (e.g., -15 to -50 points).
   - Severity level: Low, Moderate, High, or Critical.
3. **Sub-base Failure Mechanism**:
   - What underlying geotechnical cause created this? (e.g., moisture infiltration in base layer, freeze-thaw pumping, inadequate asphalt binder thickness, heavy axle fatigue).
4. **Hazard Profile**:
   - Two-wheeler / motorcycle tire entrapment hazard.
   - Hydroplaning & vehicle suspension bottoming risk.
5. **Recommended Engineering Intervention**:
   - Immediate temporary holding patch (e.g. cold-mix asphalt, polymer-modified emulsion).
   - Permanent reconstruction protocol (e.g. full-depth reclamation, mill & asphalt concrete inlay 50mm, stress-absorbing membrane interlayer).

Format your response in crisp, clean, structured markdown with bullet points and bold technical terms.`;

    const contents = imagePart
      ? { parts: [imagePart, { text: promptText }] }
      : promptText;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
    });

    res.json({
      success: true,
      analysis: response.text,
      timestamp: new Date().toISOString(),
      model: "gemini-3.8-flash",
    });
  } catch (err: any) {
    console.error("Gemini defect analysis error:", err);
    res.status(500).json({
      error: err?.message || "Failed to analyze road defect with Gemini Vision.",
    });
  }
});

// 5. Interactive Road Safety Copilot (Chat & Query)
app.post("/api/gemini/copilot", async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured in Secrets. Please verify your secrets in AI Studio Settings.",
      });
    }

    const { message, history, context } = req.body;

    let systemContext = `You are the RoadSense AI Intelligent Engineering Copilot.
You assist civil engineers, municipal authorities, urban planners, and safety auditors in understanding geospatial road risk assessments.
RoadSense AI fuses:
1. OpenStreetMap (OSM) highway infrastructure, sidewalks, speed limits, crossing tags.
2. Satellite optical imagery with U-Net road segmentation and Siamese temporal change detection.
3. Ground-level vehicle vision (YOLOv8 defect detection, ViT surface classification, Grad-CAM interpretability).
4. Explainable fused risk scoring calibrated to municipal road maintenance budgets.

Current Active Corridor: ${context?.corridorName || "Preset Corridor"} (${context?.city || ""}, ${context?.country || ""})
Active Selected Road Segment: ${context?.roadName || "All segments"}
Current Composite Risk Score: ${context?.riskScore || "N/A"}/100 (${context?.riskLevel || "N/A"})

Answer user inquiries accurately, concisely, and with engineering precision. Use standard international pavement and transportation engineering terminology (AASHTO, Eurocode, IRC, FHWA).`;

    const conversationParts: string[] = [systemContext];

    if (Array.isArray(history)) {
      history.slice(-6).forEach((h: { role: string; text: string }) => {
        conversationParts.push(`${h.role === "user" ? "User" : "RoadSense Copilot"}: ${h.text}`);
      });
    }

    conversationParts.push(`User: ${message}`);
    conversationParts.push("RoadSense Copilot:");

    const fullPrompt = conversationParts.join("\n\n");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: fullPrompt,
    });

    res.json({
      success: true,
      reply: response.text,
      model: "gemini-3.8-flash",
    });
  } catch (err: any) {
    console.error("Gemini copilot error:", err);
    res.status(500).json({
      error: err?.message || "Failed to query RoadSense Copilot.",
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
