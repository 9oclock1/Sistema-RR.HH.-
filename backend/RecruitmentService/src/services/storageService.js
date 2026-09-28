import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const storageDriver = process.env.STORAGE_DRIVER || "local";
const uploadDir = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || "uploads/cvs",
);

let s3Client = null;
if (storageDriver === "s3") {
  s3Client = new S3Client({
    region: process.env.OCI_S3_REGION,
    endpoint: process.env.OCI_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.OCI_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.OCI_S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

export const saveFile = async (file, customFileName) => {
  const fileName = customFileName || `${Date.now()}-${file.originalname}`;

  if (storageDriver === "s3") {
    const bucket = process.env.OCI_S3_BUCKET_NAME;
    const key = `cvs/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3Client.send(command);

    return {
      storage: "s3",
      url: `${process.env.OCI_S3_ENDPOINT}/${bucket}/${key}`,
      key,
      mimetype: file.mimetype,
    };
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  await fs.promises.writeFile(filePath, file.buffer);

  return {
    storage: "local",
    url: `/uploads/cvs/${fileName}`,
    path: filePath,
    mimetype: file.mimetype,
  };
};

export const getFileDetails = async (fileUrl) => {
  if (storageDriver === "s3") {
    const bucket = process.env.OCI_S3_BUCKET_NAME;
    const key = fileUrl.split(`${bucket}/`)[1];
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const s3Item = await s3Client.send(command);

    return {
      type: "stream",
      stream: s3Item.Body,
      contentType: s3Item.ContentType,
    };
  }

  const fileName = path.basename(fileUrl);
  const localFilePath = path.join(uploadDir, fileName);

  if (!fs.existsSync(localFilePath)) {
    const error = new Error(
      "El archivo físico del CV no fue encontrado en el servidor.",
    );
    error.statusCode = 404;
    throw error;
  }

  return {
    type: "local",
    filePath: localFilePath,
  };
};
