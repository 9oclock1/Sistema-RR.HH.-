import multer from "multer";

const MAX_SIZE_BYTES =
  (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "application/pdf", // pdf
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(
      "Formato no permitido. Solo se aceptan archivos PDF o DOCX.",
    );
    error.code = "INVALID_FILE_TYPE";
    return cb(error, false);
  }
  cb(null, true);
};

export const cvUpload = multer({
  storage,
  limits: {
    fileSize: MAX_SIZE_BYTES,
  },
  fileFilter,
});
