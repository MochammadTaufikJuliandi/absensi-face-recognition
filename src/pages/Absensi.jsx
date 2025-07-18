import Webcam from "react-webcam";
import { useRef, useState } from "react";
import { saveAttendance } from "../utils/firestore";
import Toast from "../components/Toast";
import * as tf from "@tensorflow/tfjs";

const MODEL_URL = "/tfjs_model/model.json";
const CLASS_NAMES = ["Sisy", "Widia", "Yoga"];

// Fungsi bantu untuk memastikan gambar sudah termuat sebelum diproses
function loadImageAsync(imageSrc) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.src = imageSrc;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

function Absensi() {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState("Belum memulai absensi");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [canAbsensi, setCanAbsensi] = useState(true);

  const handleAbsensi = async () => {
    setLoading(true);
    setStatus("Mendeteksi wajah...");
    setCanAbsensi(false);

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setStatus("Gagal mengambil gambar dari webcam.");
      setToast({
        message: "Gagal mengambil gambar dari webcam.",
        type: "error",
      });
      setLoading(false);
      setCanAbsensi(true);
      return;
    }

    let model;
    try {
      model = await tf.loadLayersModel(MODEL_URL);
    } catch (e) {
      setStatus("Gagal memuat model.");
      setToast({ message: "Gagal memuat model.", type: "error" });
      setLoading(false);
      setCanAbsensi(true);
      return;
    }

    try {
      const img = await loadImageAsync(imageSrc);
      const tensor = tf.browser
        .fromPixels(img)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .div(255.0)
        .expandDims();

      const prediction = model.predict(tensor);
      const predictionData = await prediction.data();
      const maxIdx = predictionData.indexOf(Math.max(...predictionData));
      const confidence = predictionData[maxIdx];

      if (confidence < 0.8) {
        setStatus("Wajah tidak terdeteksi. Silakan ulangi.");
        setToast({
          message: "Wajah tidak terdeteksi. Silakan ulangi.",
          type: "error",
        });
      } else {
        const predictedName = CLASS_NAMES[maxIdx];
        const timestamp = new Date().toISOString();
        const success = await saveAttendance(predictedName, timestamp);

        setStatus(success ? `Absensi berhasil: ${predictedName}` : "Gagal menyimpan absensi");
        setToast({
          message: success
            ? `Absensi tercatat untuk ${predictedName}`
            : "Terjadi kesalahan saat menyimpan.",
          type: success ? "success" : "error",
        });
      }
    } catch (error) {
      console.error("Error saat memproses gambar:", error);
      setStatus("Gagal memproses gambar.");
      setToast({ message: "Gagal memproses gambar.", type: "error" });
    } finally {
      setLoading(false);
      setCanAbsensi(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100">
      <Toast
        show={toast !== null}
        message={toast ? toast.message : ""}
        type={toast ? toast.type : ""}
        onClose={() => setToast(null)}
      />
      <div className="w-full max-w-md mx-auto">
        <h2 className="text-2xl font-semibold mb-4 text-center">Halaman Absensi</h2>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          className="rounded-lg shadow-md w-full mb-4"
          style={{ transform: "scaleX(-1)" }}
        />
        <button
          onClick={handleAbsensi}
          className="w-full bg-gradient-to-r from-red-600 to-black text-white px-6 py-3 rounded-2xl font-semibold shadow-lg hover:scale-105 transition-transform"
          disabled={loading || !canAbsensi}
        >
          {loading ? "Memproses absensi..." : "Mulai Absensi"}
        </button>
        <p className="mt-4 text-gray-700 text-center">{status}</p>
      </div>
    </div>
  );
}

export default Absensi;
