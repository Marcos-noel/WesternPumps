import React, { useState } from "react";
import { Button, Input, Select, message, Upload } from "antd";
import { UploadOutlined, CameraOutlined } from "@ant-design/icons";
import { uploadJobPhoto } from "../api/jobs";

interface JobPhotoUploadProps {
  jobId?: number;
  onUploadComplete: () => void;
}

const photoTypeOptions = [
  { value: "GENERAL", label: "General" },
  { value: "BEFORE", label: "Before" },
  { value: "AFTER", label: "After" },
  { value: "PROGRESS", label: "Progress" },
  { value: "DEFECT", label: "Defect" },
];

export default function JobPhotoUpload({ jobId, onUploadComplete }: JobPhotoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [photoType, setPhotoType] = useState("GENERAL");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const handleUpload = async () => {
    if (!file || !jobId) {
      message.error("Please select a file");
      return;
    }
    setUploading(true);
    try {
      await uploadJobPhoto(jobId, file, photoType, description);
      message.success("Photo uploaded successfully");
      onUploadComplete();
    } catch (err: any) {
      message.error(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      message.error("Could not access camera");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const capturedFile = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
          setFile(capturedFile);
          stopCamera();
        }
      }, "image/jpeg");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  return (
    <div style={{ padding: "10px 0" }}>
      {showCamera ? (
        <div>
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: 8 }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Button onClick={capturePhoto} icon={<CameraOutlined />}>Capture</Button>
            <Button onClick={stopCamera}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button onClick={startCamera} icon={<CameraOutlined />} style={{ marginRight: 8 }}>
              Use Camera
            </Button>
            <Upload
              beforeUpload={(f) => {
                setFile(f);
                return false;
              }}
              showUploadList={false}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </div>
          {file && (
            <div style={{ marginBottom: 16 }}>
              <p>Selected: {file.name}</p>
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                loading="lazy"
                decoding="async"
                style={{ maxWidth: 200, borderRadius: 8 }}
              />
            </div>
          )}
          <Select
            value={photoType}
            onChange={setPhotoType}
            options={photoTypeOptions}
            style={{ width: "100%", marginBottom: 16 }}
            placeholder="Select photo type"
          />
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploading}
            disabled={!file}
            block
          >
            Upload Photo
          </Button>
        </>
      )}
    </div>
  );
}
