package project

import (
	"context"
	"errors"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Syncer struct {
	Client *s3.Client
	Bucket string
	Prefix string
}

func NewS3Syncer(ctx context.Context, region string, bucket string, prefix string) (*S3Syncer, error) {
	region = strings.TrimSpace(region)
	bucket = strings.TrimSpace(bucket)
	prefix = strings.Trim(strings.TrimSpace(prefix), "/")

	if region == "" {
		return nil, errors.New("AWS_REGION is required when STORAGE_DRIVER=s3")
	}

	if bucket == "" {
		return nil, errors.New("S3_BUCKET is required when STORAGE_DRIVER=s3")
	}

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, err
	}

	return &S3Syncer{
		Client: s3.NewFromConfig(cfg),
		Bucket: bucket,
		Prefix: prefix,
	}, nil
}

func (s *S3Syncer) key(parts ...string) string {
	cleaned := make([]string, 0, len(parts)+1)

	if s.Prefix != "" {
		cleaned = append(cleaned, s.Prefix)
	}

	for _, part := range parts {
		part = strings.Trim(strings.ReplaceAll(part, "\\", "/"), "/")
		if part != "" {
			cleaned = append(cleaned, part)
		}
	}

	return strings.Join(cleaned, "/")
}

func safeJoin(root string, relative string) (string, error) {
	relative = strings.ReplaceAll(relative, "\\", "/")
	relative = strings.TrimPrefix(relative, "/")

	if relative == "" || strings.Contains(relative, "\x00") {
		return "", ErrInvalidPath
	}

	cleaned := filepath.Clean(filepath.FromSlash(relative))
	target := filepath.Join(root, cleaned)

	rel, err := filepath.Rel(root, target)
	if err != nil {
		return "", err
	}

	if strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", ErrInvalidPath
	}

	return target, nil
}

func contentTypeForPath(path string) string {
	ext := strings.ToLower(filepath.Ext(path))

	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".json":
		return "application/json"
	case ".typ":
		return "text/plain; charset=utf-8"
	case ".log", ".txt":
		return "text/plain; charset=utf-8"
	}

	if detected := mime.TypeByExtension(ext); detected != "" {
		return detected
	}

	return "application/octet-stream"
}

func (s *S3Syncer) UploadDirectory(ctx context.Context, localDir string, keyPrefix string) error {
	if s == nil {
		return nil
	}

	localDir, err := filepath.Abs(localDir)
	if err != nil {
		return err
	}

	if _, err := os.Stat(localDir); err != nil {
		return err
	}

	return filepath.WalkDir(localDir, func(current string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if entry.IsDir() {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		relative, err := filepath.Rel(localDir, current)
		if err != nil {
			return err
		}

		relative = filepath.ToSlash(relative)

		file, err := os.Open(current)
		if err != nil {
			return err
		}

		defer file.Close()

		_, err = s.Client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(s.Bucket),
			Key:         aws.String(s.key(keyPrefix, relative)),
			Body:        file,
			ContentType: aws.String(contentTypeForPath(current)),
		})

		return err
	})
}

func (s *S3Syncer) DeletePrefix(ctx context.Context, keyPrefix string) error {
	if s == nil {
		return nil
	}

	prefix := s.key(keyPrefix)
	paginator := s3.NewListObjectsV2Paginator(s.Client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.Bucket),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return err
		}

		for _, object := range page.Contents {
			if object.Key == nil {
				continue
			}

			if _, err := s.Client.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket: aws.String(s.Bucket),
				Key:    object.Key,
			}); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *S3Syncer) RestoreToLocal(ctx context.Context, localRoot string) error {
	if s == nil {
		return nil
	}

	localRoot, err := filepath.Abs(localRoot)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(localRoot, 0755); err != nil {
		return err
	}

	prefix := s.key()
	if prefix != "" {
		prefix += "/"
	}

	paginator := s3.NewListObjectsV2Paginator(s.Client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.Bucket),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return err
		}

		for _, object := range page.Contents {
			if object.Key == nil {
				continue
			}

			key := *object.Key
			relative := strings.TrimPrefix(key, prefix)

			if strings.TrimSpace(relative) == "" {
				continue
			}

			target, err := safeJoin(localRoot, relative)
			if err != nil {
				return err
			}

			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}

			output, err := os.Create(target)
			if err != nil {
				return err
			}

			response, err := s.Client.GetObject(ctx, &s3.GetObjectInput{
				Bucket: aws.String(s.Bucket),
				Key:    aws.String(key),
			})

			if err != nil {
				_ = output.Close()
				return err
			}

			_, copyErr := io.Copy(output, response.Body)
			closeBodyErr := response.Body.Close()
			closeFileErr := output.Close()

			if copyErr != nil {
				return copyErr
			}

			if closeBodyErr != nil {
				return closeBodyErr
			}

			if closeFileErr != nil {
				return closeFileErr
			}
		}
	}

	return nil
}

func (s *FileSystemStore) SetSyncer(syncer *S3Syncer) {
	s.Syncer = syncer
}

func (s *FileSystemStore) RestoreFromRemote(ctx context.Context) error {
	if s.Syncer == nil {
		return nil
	}

	root := filepath.Dir(s.ProjectsRoot)

	return s.Syncer.RestoreToLocal(ctx, root)
}

func (s *FileSystemStore) SyncProject(ctx context.Context, projectID string) error {
	if s.Syncer == nil {
		return nil
	}

	return s.Syncer.UploadDirectory(ctx, s.ProjectDir(projectID), "projects/"+projectID)
}

func (s *FileSystemStore) SyncBuild(ctx context.Context, buildID string) error {
	if s.Syncer == nil {
		return nil
	}

	return s.Syncer.UploadDirectory(ctx, s.BuildDir(buildID), "builds/"+buildID)
}

func (s *FileSystemStore) DeleteRemoteProject(ctx context.Context, projectID string) error {
	if s.Syncer == nil {
		return nil
	}

	return s.Syncer.DeletePrefix(ctx, "projects/"+projectID)
}
