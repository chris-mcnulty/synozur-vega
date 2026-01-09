import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient, parseObjectPath, signObjectURL } from "./objectStorage";
import { randomUUID } from "crypto";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  /**
   * Request a presigned URL for showcase image upload (public).
   * Images are stored in the public directory and served publicly.
   */
  app.post("/api/uploads/showcase-image", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }

      if (!contentType?.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      // Get the public search path and use it for showcase images
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      if (publicPaths.length === 0) {
        return res.status(500).json({ error: "Public storage not configured" });
      }

      // Generate a unique filename to prevent collisions
      const ext = name.split(".").pop() || "png";
      const uniqueId = randomUUID();
      const objectName = `showcase/${uniqueId}.${ext}`;
      const fullPath = `${publicPaths[0]}/${objectName}`;

      const { bucketName, objectName: parsedObjectName } = parseObjectPath(fullPath);

      // Sign URL for PUT method with 15 minute TTL
      const uploadURL = await signObjectURL({
        bucketName,
        objectName: parsedObjectName,
        method: "PUT",
        ttlSec: 900,
      });

      // Construct the public URL for serving the image
      const publicUrl = `/public-assets/${objectName}`;

      res.json({
        uploadURL,
        publicUrl,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating showcase upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Request a presigned URL for branding image upload (logos, favicons).
   * Images are stored in the public directory and served publicly.
   */
  app.post("/api/uploads/branding-image", async (req, res) => {
    try {
      const { name, size, contentType, tenantId, imageType } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }

      if (!contentType?.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      if (!tenantId) {
        return res.status(400).json({ error: "Missing required field: tenantId" });
      }

      if (!imageType || !["logo", "logoDark", "favicon"].includes(imageType)) {
        return res.status(400).json({ error: "imageType must be one of: logo, logoDark, favicon" });
      }

      // Get the public search path
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      if (publicPaths.length === 0) {
        return res.status(500).json({ error: "Public storage not configured" });
      }

      // Generate a unique filename based on tenant and image type
      const ext = name.split(".").pop() || "png";
      const uniqueId = randomUUID();
      const objectName = `branding/${tenantId}/${imageType}-${uniqueId}.${ext}`;
      const fullPath = `${publicPaths[0]}/${objectName}`;

      const { bucketName, objectName: parsedObjectName } = parseObjectPath(fullPath);

      // Sign URL for PUT method with 15 minute TTL
      const uploadURL = await signObjectURL({
        bucketName,
        objectName: parsedObjectName,
        method: "PUT",
        ttlSec: 900,
      });

      // Construct the public URL for serving the image
      const publicUrl = `/public-assets/${objectName}`;

      res.json({
        uploadURL,
        publicUrl,
        metadata: { name, size, contentType, tenantId, imageType },
      });
    } catch (error) {
      console.error("Error generating branding upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve public assets (showcase images, etc.)
   */
  app.get("/public-assets/:assetPath(*)", async (req, res) => {
    try {
      const assetPath = req.params.assetPath;
      const objectFile = await objectStorageService.searchPublicObject(assetPath);
      
      if (!objectFile) {
        return res.status(404).json({ error: "Asset not found" });
      }

      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving public asset:", error);
      return res.status(500).json({ error: "Failed to serve asset" });
    }
  });
}

