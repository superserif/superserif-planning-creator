/** Logo Moon-Moon — jaune sur pastille ink, lisible à petite taille. */
export default function MoonMoonIcon({ className = "size-4" }: { className?: string }) {
  return (
    <span
      title="Projet Moon-Moon"
      className={`${className} flex shrink-0 items-center justify-center rounded-[0.25rem] bg-ink p-[0.1875rem]`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 29 24"
        className="h-full w-auto"
        aria-hidden="true"
      >
        <path
          fill="#FFD43A"
          d="M8.78827 0.000289947C9.94305 -0.00922805 11.0877 0.21568 12.153 0.661399C13.2183 1.10712 14.1821 1.76437 14.986 2.59339C16.7148 4.32212 17.5791 6.38802 17.5791 8.79109V23.467H11.0688V8.79109C11.0575 8.18981 10.8136 7.61632 10.3883 7.19108C9.96305 6.76584 9.38955 6.52194 8.78827 6.51063H6.50781V0.27983C7.25352 0.0929389 8.0195 -0.000954053 8.78827 0.000289947Z"
        />
        <path fill="#FFD43A" d="M6.51034 6.50977H0V23.4661H6.51034V6.50977Z" />
        <path
          fill="#FFD43A"
          d="M19.8585 0.000289947C21.0133 -0.00922805 22.158 0.21568 23.2233 0.661399C24.2886 1.10712 25.2523 1.76437 26.0562 2.59339C27.785 4.32212 28.6493 6.38802 28.6493 8.79109V23.467H22.139V8.79109C22.1277 8.18981 21.8838 7.61632 21.4585 7.19108C21.0333 6.76584 20.4598 6.52194 19.8585 6.51063H17.5781V0.27983C18.3238 0.0929389 19.0898 -0.000954053 19.8585 0.000289947Z"
        />
      </svg>
    </span>
  );
}
