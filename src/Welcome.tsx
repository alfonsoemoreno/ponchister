import React from "react";

interface WelcomeProps {
  onAccept: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onAccept }) => (
  <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light">
    <div className="card p-5 shadow-lg text-center">
      <h1 className="mb-4">Bienvenido a Ponchister</h1>
      <p className="mb-4">
        ¡Tu app para escanear y escuchar videos de YouTube!
      </p>
      <button className="btn btn-primary btn-lg" onClick={onAccept}>
        Aceptar
      </button>
    </div>
  </div>
);

export default Welcome;
