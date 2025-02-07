import csv

from matplotlib import pyplot as plt
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.metrics import silhouette_score
from application_state import ApplicationState
from loguru import logger
from collections import Counter
from models import (
    AlgorithmSettings,
    AutomaticClusterCount,
    Cluster,
    FileSettings,
    ManualClusterCount,
    Merger,
    MergingStatistics,
    OutlierStatistic,
    Response,
    OutlierStatistics,
    ClusterSimilarityPair,
    ClusteringResult,
)


class Clusterer:
    def __init__(self, app_state: ApplicationState):
        file_path = app_state.get_file_path()
        file_settings = app_state.get_file_settings()
        algorithm_settings = app_state.get_algorithm_settings()
        if not file_path or not file_settings or not algorithm_settings:
            raise ValueError("Invalid Application State")
        self.file_path = file_path
        self.file_settings = file_settings
        self.algorithm_settings = algorithm_settings
        self.output_dir = "output"

    def process_input_file(self, excluded_words: list[str]):
        rows: list[list[str]] = []
        response_counter: Counter[str] = Counter()
        try:
            with open(self.file_path, encoding="utf-8") as f:
                reader = csv.reader(f, delimiter=self.file_settings.delimiter)
                if self.file_settings.has_header:
                    headers = reader.__next__()
                else:
                    headers = []

                for row in reader:
                    rows.append(row)

                    for column_index in self.file_settings.selected_columns:
                        if column_index >= len(row):
                            logger.warning(
                                f"Skipping invalid column {column_index} in row {reader.line_num}"
                            )
                            continue
                        # get the next entry provided by the current participant
                        response = row[column_index].strip().lower()
                        if response == "" or response is None:
                            continue
                        for excluded_word in excluded_words:
                            if (
                                excluded_word != ""
                                and excluded_word.lower() in response.lower()
                            ):
                                logger.info(
                                    f"Excluded word found: {excluded_word} in response: {response}"
                                )
                                break
                        # otherwise, count the response
                        response_counter[response] += 1
            responses = list(response_counter.keys())
            responses = [
                Response(text=response, count=count)
                for response, count in response_counter.items()
            ]
            full_file_content = [headers] + rows
            return responses, full_file_content
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            return [], []

    def load_embedding_model(self, language_model: str):
        try:
            return SentenceTransformer(language_model)
        except Exception as e:
            logger.error(f"Error loading embedding model: {e}")
            raise

    def embed_responses(
        self, responses: list[Response], embedding_model: SentenceTransformer
    ):
        # Side Effect: Embeds the responses and sets the embeddings in the Response objects
        norm_embeddings = embedding_model.encode(
            [response.text for response in responses], normalize_embeddings=True
        )
        for i, response in enumerate(responses):
            response.embedding = norm_embeddings[i].tolist()
        return norm_embeddings

    def detect_outliers(
        self,
        responses: list[Response],
        embeddings: np.ndarray,
        outlier_k: int,
        z_score_threshold: float,
    ):
        # Potential for visualization: plot the distribution of average neighbor similarities
        if len(responses) == 0:
            logger.warning("No responses to analyze for outliers")
            return OutlierStatistics(threshold=0.0, outliers=[])
        if outlier_k >= len(responses) - 1:
            outlier_k = len(responses) - 2
        similarity_matrix = np.dot(embeddings, embeddings.T)
        partition = np.partition(-similarity_matrix, outlier_k + 1, axis=1)
        sorted_neighborhood_partition = np.copy(partition)
        sorted_neighborhood_partition[:, : outlier_k + 1] = np.sort(
            partition[:, : outlier_k + 1], axis=1
        )
        avg_neighbor_sim = np.mean(
            -sorted_neighborhood_partition[:, 1 : outlier_k + 1], axis=1
        )

        outlier_threshold = np.mean(avg_neighbor_sim) - z_score_threshold * np.std(
            avg_neighbor_sim
        )

        outlier_stats = []
        outlier_bools = avg_neighbor_sim < outlier_threshold

        for index in np.where(outlier_bools)[0]:
            responses[index].is_outlier = True

        outliers = [response for response in responses if response.is_outlier]

        outlier_statistics_summary = OutlierStatistics(
            threshold=outlier_threshold, outliers=[]
        )

        for i, response in enumerate(outliers):
            sim = avg_neighbor_sim[np.where(outlier_bools)[0][i]]
            outlier_stats.append(
                OutlierStatistic(
                    similarity=sim,
                    response=response,
                    response_id=response.id,
                    outlier_statistics_id=outlier_statistics_summary.id,
                )
            )

        outlier_statistics_summary.outliers = outlier_stats

        return outlier_statistics_summary

    def auto_cluster_count(self, embeddings, response_weights):
        assert self.algorithm_settings.method.cluster_count_method == "auto"
        max_clusters = self.algorithm_settings.method.max_clusters

        # TODO: Implement more sophisticated method
        if max_clusters < 50:
            # for max_num_clusters < 50, we try every possible value
            K_values = list(range(2, max_clusters + 1))
        elif max_clusters < 100:
            # for max_num_clusters >= 50, we try every fifth value
            K_values = list(range(2, 51)) + list(range(55, max_clusters + 1, 5))
        else:
            # for max_num_clusters >= 100, we try every tenth value
            K_values = (
                list(range(2, 51))
                + list(range(55, 101, 5))
                + list(range(110, max_clusters + 1, 10))
            )

        sil_scores, inertias, calinski_scores, bic_scores = [], [], [], []

        for K in K_values:
            # TODO: improve with early stopping
            if K >= len(embeddings) - 1:
                continue
            clustering = KMeans(n_clusters=K, n_init="auto", random_state=42).fit(
                embeddings, sample_weight=response_weights
            )
            labels = clustering.labels_

            # Silhouette Score
            sil = silhouette_score(embeddings, labels)
            sil_scores.append(sil)

            # Inertia
            inertias.append(clustering.inertia_)

            # Custom Calinski-Harabasz
            calinski = weighted_calinski_harabasz(
                embeddings, labels, response_weights, clustering.cluster_centers_
            )
            calinski_scores.append(calinski)

            # BIC
            bic = len(embeddings) * np.log(clustering.inertia_) + K * np.log(
                len(embeddings)
            )
            bic_scores.append(bic)

        # Normalize metrics
        sil_norm = normalize(sil_scores, higher_better=True)
        inertia_norm = normalize(inertias, higher_better=False)
        calinski_norm = normalize(calinski_scores, higher_better=True)
        bic_norm = normalize(bic_scores, higher_better=False)

        # Combine scores (adjust weights as needed)
        weights = [0.4, 0.1, 0.4, 0.1]  # Silhouette, Inertia, Calinski, BIC
        combined_scores = [
            w * s + w_i * i + w_c * c + w_b * b
            for s, i, c, b in zip(sil_norm, inertia_norm, calinski_norm, bic_norm)
            for w, w_i, w_c, w_b in [weights]
        ]

        best_idx = np.argmax(combined_scores)
        best_K = K_values[best_idx]

        # Plot the results
        plot_cluster_metrics(
            K_values,
            sil_norm,
            inertia_norm,
            calinski_norm,
            bic_norm,
            combined_scores,
            best_K,
        )

        return best_K

    def start_clustering(
        self,
        responses: list[Response],
        embeddings: np.ndarray,
        K: int,
        response_weights: np.ndarray,
    ):
        # Side Effect: Assigns cluster IDs to responses
        clustering = KMeans(n_clusters=K, n_init="auto", random_state=42).fit(
            embeddings, sample_weight=response_weights
        )
        cluster_indices = np.copy(clustering.labels_)
        valid_clusters = [i for i in range(K) if np.sum(cluster_indices == i) > 0]
        K = len(valid_clusters)
        cluster_indices = np.array(
            [valid_clusters.index(idx) for idx in cluster_indices]
        )
        cluster_centers = clustering.cluster_centers_
        for i, response in enumerate(responses):
            response.cluster_id = cluster_indices[i]

        clusters = []
        for i in range(K):
            cluster = Cluster(
                id=i,
                center=cluster_centers[i].tolist(),
                count=np.sum(cluster_indices == i),
                responses=[
                    response for response in responses if response.cluster_id == i
                ],
            )
            clusters.append(cluster)

        return clusters

    def merge_clusters(
        self,
        clusters: list[Cluster],
        similarity_threshold: float,
    ):
        # merge the closest clusters using Agglomorative Clustering
        # until everything is closer than the threshold
        meta_clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=1.0 - similarity_threshold,
            linkage="complete",
            metric="cosine",
        ).fit(np.asarray([cluster.center for cluster in clusters]))

        cluster_centers = np.asarray(
            [np.asarray(cluster.center) for cluster in clusters]
        )
        meta_clustering_indices = meta_clustering.labels_

        mergers: list[Merger] = []
        post_merge_cluster_ids = [cluster.id for cluster in clusters]
        for merged_cluster_group_index in np.unique(meta_clustering_indices):
            merged_cluster_indices = np.where(
                meta_clustering_indices == merged_cluster_group_index
            )[0].tolist()
            assert isinstance(merged_cluster_indices, list)
            if len(merged_cluster_indices) > 1:
                S = np.dot(
                    cluster_centers[merged_cluster_indices, :],
                    cluster_centers[merged_cluster_indices, :].T,
                )
                triu_indices = np.triu_indices(len(S), k=1)
                similarity_pairs = []
                merged_clusters: list[Cluster] = [
                    clusters[i]  # type: ignore
                    for i in merged_cluster_indices
                ]
                for i, j in zip(triu_indices[0], triu_indices[1]):
                    similarity_pairs.append(
                        ClusterSimilarityPair(
                            clusters=[merged_clusters[i], merged_clusters[j]],
                            similarity=S[i, j],
                        )
                    )
                similarity_pairs.sort(key=lambda x: x.similarity, reverse=True)
                merger = Merger(
                    clusters=merged_clusters,
                    similarity_pairs=similarity_pairs,
                )
                mergers.append(merger)
                # merge the clusters
                merged_clusters[0].responses.extend(
                    [
                        response
                        for cluster in merged_clusters[1:]
                        for response in cluster.responses
                    ]
                )
                # re-set the cluster centers to the weighted mean of all their
                # points and normalize them to unit length
                merged_clusters[0].center = np.average(
                    [cluster.center for cluster in merged_clusters],
                    axis=0,
                    weights=[cluster.count for cluster in merged_clusters],
                ) / np.linalg.norm(
                    np.average(
                        [cluster.center for cluster in merged_clusters],
                        axis=0,
                        weights=[cluster.count for cluster in merged_clusters],
                    ),
                    ord=2,
                )

                for cluster in merged_clusters[1:]:
                    post_merge_cluster_ids.remove(cluster.id)

        clusters = [
            cluster for cluster in clusters if cluster.id in post_merge_cluster_ids
        ]
        return MergingStatistics(
            mergers=mergers, threshold=similarity_threshold
        ), clusters

    def calculate_inter_cluster_similarities(self, clusters: list[Cluster]):
        # Calculate the similarity between all pairs of clusters
        cluster_centers = np.asarray(
            [np.asarray(cluster.center) for cluster in clusters]
        )
        S = np.dot(cluster_centers, cluster_centers.T)
        triu_indices = np.triu_indices(len(S), k=1)
        cluster_similarity_pairs = []
        for i, j in zip(triu_indices[0], triu_indices[1]):
            cluster_similarity_pairs.append(
                ClusterSimilarityPair(
                    clusters=[clusters[i], clusters[j]],
                    similarity=S[i, j],
                )
            )
        return cluster_similarity_pairs

    def run(self) -> ClusteringResult:
        responses, full_file_content = self.process_input_file([])

        embedding_model = self.load_embedding_model("BAAI/bge-large-en-v1.5")

        embeddings = self.embed_responses(responses, embedding_model)

        outlier_stats = self.detect_outliers(
            responses, embeddings, outlier_k=5, z_score_threshold=1.5
        )

        # Update responses to exclude outliers
        responses = [response for response in responses if not response.is_outlier]
        embeddings = np.array([response.embedding for response in responses])

        response_weights = np.array([response.count for response in responses])

        if self.algorithm_settings.method.cluster_count_method == "auto":
            K = self.auto_cluster_count(embeddings, response_weights)
        else:
            K = self.algorithm_settings.method.cluster_count

        clusters = self.start_clustering(responses, embeddings, K, response_weights)

        merger_stats, clusters = self.merge_clusters(
            clusters, similarity_threshold=0.85
        )

        return ClusteringResult(
            clusters=clusters,
            outlier_statistics=outlier_stats,
            merger_statistics=merger_stats,
            inter_cluster_similarities=self.calculate_inter_cluster_similarities(
                clusters
            ),
        )


def plot_cluster_metrics(
    K_values, sil_norm, inertia_norm, calinski_norm, bic_norm, combined_scores, best_K
):
    plt.figure(figsize=(12, 6))
    plt.plot(K_values, sil_norm, label="Silhouette (Normalized)", marker="o")
    plt.plot(K_values, inertia_norm, label="Inverted Inertia (Normalized)", marker="s")
    plt.plot(
        K_values, calinski_norm, label="Calinski-Harabasz (Normalized)", marker="^"
    )
    plt.plot(K_values, bic_norm, label="Inverted BIC (Normalized)", marker="v")
    plt.plot(
        K_values,
        combined_scores,
        label="Combined Score",
        linestyle="--",
        marker="x",
    )
    plt.axvline(best_K, color="r", linestyle=":", label=f"Optimal K={best_K}")
    plt.xlabel("Number of Clusters (K)")
    plt.ylabel("Normalized Score")
    plt.title("Clustering Evaluation Metrics")
    plt.legend()
    plt.grid(True)


# Normalization function
def normalize(scores, higher_better=True):
    min_val, max_val = min(scores), max(scores)
    if max_val == min_val:
        return [0.5] * len(scores)
    if higher_better:
        return [(x - min_val) / (max_val - min_val) for x in scores]
    else:
        return [(max_val - x) / (max_val - min_val) for x in scores]


def weighted_calinski_harabasz(embeddings, labels, sample_weight, cluster_centers):
    overall_centroid = np.average(embeddings, weights=sample_weight, axis=0)
    K = len(cluster_centers)
    N = np.sum(sample_weight)

    if K <= 1:
        return 0.0

    # Between-cluster dispersion
    B = 0.0
    for label in range(K):
        mask = labels == label
        cluster_weight = sample_weight[mask].sum()
        centroid_diff = cluster_centers[label] - overall_centroid
        B += cluster_weight * np.sum(centroid_diff**2)

    # Within-cluster dispersion (inertia)
    W = np.sum(
        [
            sample_weight[i] * np.sum((x - cluster_centers[label]) ** 2)
            for i, (x, label) in enumerate(zip(embeddings, labels))
        ]
    )

    return (B / (K - 1)) / (W / (N - K)) if (W != 0 and K != 1) else 0.0


if __name__ == "__main__":
    from database_manager import DatabaseManager

    database_manager = DatabaseManager()
    app_state = ApplicationState()
    app_state.set_file_path(
        "C:\\Users\\Luis\\Projects\\Word-Clustering-Tool-for-SocPsych\\example_data\\example_short.csv"
    )
    app_state.set_file_settings(
        FileSettings(
            delimiter=";",
            has_header=True,
            selected_columns=[1, 2, 3, 4, 5, 6, 7, 8, 9],
        )
    )
    app_state.set_algorithm_settings(
        AlgorithmSettings(method=ManualClusterCount(cluster_count=50))
    )
    algo_settings = app_state.get_algorithm_settings()
    assert algo_settings is not None
    clusterer = Clusterer(app_state)
    result = clusterer.run()
